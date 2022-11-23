"use strict";
const Difficulty = [
    "BEGGINER",
    "NORMAL",
    "HYPER",
    "ANOTHER",
    "LEGGENDARIA"
];
const ClearType = [
    "NOPLAY",
    "FAILED",
    "ASSISTCLEAR",
    "EASYCLEAR",
    "CLEAR",
    "HARDCLEAR",
    "EXHARDCLEAR",
    "FULLCOMBO",
];
class Scraper {
    async getPage(url) {
        let res = await fetch(url.toString(), { method: "GET" });
        if (res.url.indexOf("error.html") > -1 || !res.ok || res.status !== 200) {
            throw new Error();
        }
        return (await res.blob()).text();
    }
    parseScoresOfPage(text) {
        const table = text.match(/<div class="series-difficulty">.*?<div class="next-prev">/)?.[0];
        if (!table)
            return [];
        const trs = table.match(/<tr>.*?<\/tr>/g);
        if (!trs)
            return [];
        const _level = trs[0].match(/<th.*>SP LEVEL [0-9]*<\/th>/)?.[0];
        if (!_level)
            return [];
        const level = _level.replace(/(<th.*>SP LEVEL |<\/th>)/g, "");
        let res = [];
        for (let key in trs) {
            const tr = trs[key];
            const tds = tr.match(/(<td>).*?(<\/td>)/g);
            if (!tds)
                continue;
            const hastitle = tds[0].match(/(\"music_win\">).*?(<\/a>)/)?.[0];
            if (!hastitle)
                continue;
            const title = hastitle.replace(/\"music_win\">|<\/a>/g, "");
            const diff = tds[1].replace(/(<td>|<\/td>)/g, "");
            const _djlevel = tds[2].match(/.*\/.*\.gif\"/g)?.[0];
            const djlevel = _djlevel ? _djlevel.replace(/.*\/|\.gif\".*/g, "") : "unknown";
            const exscore = tds[3].replace(/<td>|<br>|<\/td>/g, "");
            const cleartype_index = Number(tds[4].replace(/.*\/clflg|\.gif\".*/g, ""));
            const cleartype = ClearType[cleartype_index];
            const scoreinfo = {
                title: title,
                difficulty: diff,
                level: level,
                djlevel: djlevel,
                exscore: exscore,
                cleartype: cleartype
            };
            res.push(scoreinfo);
        }
        return res;
    }
    hasNext(text) {
        const navinext = text.match(/<div class="navi-next">/);
        return Boolean(navinext);
    }
    async *iterScoresOfLevel(level) {
        if (level <= 0 || level > 12)
            return [];
        level -= 1;
        const MAX_PAGES = 12; // 50*12 musics per level
        let url = new URL("https://p.eagate.573.jp/game/2dx/29/djdata/music/difficulty.html");
        url.searchParams.set("style", "0");
        url.searchParams.set("disp", "1");
        url.searchParams.set("difficult", level.toString());
        let res = [];
        for (let cnt = 0; cnt < MAX_PAGES; cnt++) {
            url.searchParams.set("offset", (cnt * 50).toString());
            const text = await this.getPage(url);
            yield this.parseScoresOfPage(text);
            if (!this.hasNext(text))
                break;
        }
        return res;
    }
}
class Main {
    constructor() {
        this.result = [];
        this.scraper = new Scraper();
        this.view = `
<div style="text-align:center;display:flex;justify-content:center;align-items:center;flex-direction:column;height:100vh;background:#fff;overflow:hidden;" id="view">
  <p id="progress"></p>
  <textarea style="width:80%;height:180px;margin:6px 0;border:1px solid #ccc;padding:6px;" id="result"></textarea>
</div>`;
    }
    setText(id, text) {
        if (!document)
            return;
        const elem = document.getElementById(id);
        if (!elem)
            return;
        elem.innerHTML = text;
    }
    ;
    json2csv(jsons) {
        const header = "title,difficulty,level,exscore,djlevel,cleartype";
        const data = jsons.map((j) => [
            j.title, j.difficulty, j.level, j.exscore, j.djlevel, j.cleartype
        ].join(","))
            .join("\n");
        return header + "\n" + data;
    }
    async exec() {
        if (document.domain.indexOf("eagate.573.jp") === -1) {
            return alert("go to eagate.573.jp");
        }
        document.body.innerHTML = this.view;
        const wait = async (ms) => new Promise(resolve => setTimeout(resolve, ms));
        for (let level = 1; level <= 12; level++) {
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
        this.setText("progress", "Done");
        this.setText("result", this.json2csv(this.result));
    }
}
new Main().exec();
