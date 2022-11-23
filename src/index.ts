const Difficulty = [
  "BEGGINER",
  "NORMAL",
  "HYPER",
  "ANOTHER",
  "LEGGENDARIA"
] as const;
type Difficulty = typeof Difficulty[number];

const ClearType = [
  "NOPLAY",
  "FAILED",
  "ASSISTCLEAR",
  "EASYCLEAR",
  "CLEAR",
  "HARDCLEAR",
  "EXHARDCLEAR",
  "FULLCOMBO",
] as const;
type ClearType = typeof ClearType[number];

interface ScoreInfo {
  title: string,
  difficulty: Difficulty,
  level: string,
  exscore: string,
  djlevel: string,
  cleartype: ClearType,
}

class Scraper {  
  private async getPage(url: URL): Promise<string> {
    let res = await fetch(url.toString(), { method: "GET" });
    if (res.url.indexOf("error.html") > -1 || !res.ok || res.status !== 200) {
      throw new Error();
    }
    return (await res.blob()).text();
  }
  private parseScoresOfPage(text: string): ScoreInfo[] {
    const table = text.match(/<div class="series-difficulty">.*?<div class="next-prev">/)?.[0];
    if (!table) return [];
    const trs = table.match(/<tr>.*?<\/tr>/g);
    if (!trs) return [];
    const _level = trs[0].match(/<th.*>SP LEVEL [0-9]*<\/th>/)?.[0];
    if (!_level) return [];

    const level = _level.replace(/(<th.*>SP LEVEL |<\/th>)/g, "");
    let res: ScoreInfo[] = [];
    for (let key in trs) {
        const tr = trs[key];
        const tds = tr.match(/(<td>).*?(<\/td>)/g);
        if (!tds) continue;
        const hastitle = tds[0].match(/(\"music_win\">).*?(<\/a>)/)?.[0];
        if (!hastitle) continue;
        const title = hastitle.replace(/\"music_win\">|<\/a>/g, "");
        const diff = tds[1].replace(/(<td>|<\/td>)/g, "");
        const _djlevel = tds[2].match(/.*\/.*\.gif\"/g)?.[0];
        const djlevel = _djlevel? _djlevel.replace(/.*\/|\.gif\".*/g, "") : "unknown";
        const exscore = tds[3].replace(/<td>|<br>|<\/td>/g, "");
        const cleartype_index = Number(tds[4].replace(/.*\/clflg|\.gif\".*/g, ""));
        const cleartype = ClearType[cleartype_index];
        const scoreinfo: ScoreInfo = {
          title: title,
          difficulty: diff as Difficulty,
          level: level,
          djlevel: djlevel,
          exscore: exscore,
          cleartype: cleartype
        };
        res.push(scoreinfo);
    }
    return res;
  }
  private hasNext(text: string): boolean {
    const navinext = text.match(/<div class="navi-next">/);
    return Boolean(navinext)
  }
  async *iterScoresOfLevel(level: number): AsyncGenerator<ScoreInfo[]> {
    if (level <= 0 || level > 12) return [];
    level -= 1;
    const MAX_PAGES = 12; // 50*12 musics per level
    let url = new URL("https://p.eagate.573.jp/game/2dx/29/djdata/music/difficulty.html");
    url.searchParams.set("style", "0");
    url.searchParams.set("disp", "1");
    url.searchParams.set("difficult", level.toString());
    let res: ScoreInfo[] = [];
    for (let cnt = 0; cnt < MAX_PAGES; cnt++) {
      url.searchParams.set("offset", (cnt * 50).toString());
      const text = await this.getPage(url);
      yield this.parseScoresOfPage(text);
      if (!this.hasNext(text)) break;
    }    
    return res;
  }
}

class Main {
  result: ScoreInfo[]
  scraper: Scraper
  view: string
  constructor() {
    this.result = [];
    this.scraper = new Scraper();
    this.view = `
<div style="text-align:center;display:flex;justify-content:center;align-items:center;flex-direction:column;height:100vh;background:#fff;overflow:hidden;" id="view">
  <p id="progress"></p>
  <textarea style="width:80%;height:180px;margin:6px 0;border:1px solid #ccc;padding:6px;" id="result"></textarea>
</div>`;
  }
  setText(id: string, text: string) {
    if (!document) return;
    const elem = document.getElementById(id);
    if(!elem) return;
    elem.innerHTML = text;
  };
  json2csv(jsons: ScoreInfo[]){
    const header = "title,difficulty,level,exscore,djlevel,cleartype";
    const processTitle = (title: string) => {
      if (title.indexOf(",") > -1) return `\"${title}\"`;
      return title;
    };
    const data = jsons.map((j) => [
        processTitle(j.title),j.difficulty,j.level,j.exscore,j.djlevel,j.cleartype
      ].join(","))
    .join("\n");
    return header + "\n" + data;
  }
  async exec() {
    if (document.domain.indexOf("eagate.573.jp") === -1) {
      return alert("go to eagate.573.jp");
    }
    document.body.innerHTML = this.view;
    const wait = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (let level=1; level<=12; level++) {
      let count = 0;
      for await (const scores of this.scraper.iterScoresOfLevel(level)) {
        count += 1;
        this.setText("progress", `
        Loaded ${this.result.length} items
        Reading Lv${level} (${count} pages)
        `);
        this.result = this.result.concat(scores);
        wait(800);
      }
    }
    this.setText("progress", "Done")
    this.setText("result", this.json2csv(this.result));
  }
}

new Main().exec();