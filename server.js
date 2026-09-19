import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
const __dirname=path.dirname(fileURLToPath(import.meta.url)), publicDir=path.join(__dirname,'public'), rooms=new Map(), PORT=process.env.PORT||3000;
const send=(w,m)=>w.readyState===1&&w.send(JSON.stringify(m)); const broadcast=(r,m)=>r.players.forEach(p=>send(p.ws,m));
const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function board(){const b=Array.from({length:8},()=>Array(8).fill(0));b[3][3]=2;b[4][4]=2;b[3][4]=1;b[4][3]=1;return b}
function can(b,r,c,col){if(b[r]?.[c]!==0)return false;const o=3-col;for(const[d,e]of dirs){let y=r+d,x=c+e,n=0;while(b[y]?.[x]===o){n++;y+=d;x+=e}if(n&&b[y]?.[x]===col)return true}return false}
function put(b,r,c,col){if(!can(b,r,c,col))return false;const o=3-col;b[r][c]=col;for(const[d,e]of dirs){let y=r+d,x=c+e,a=[];while(b[y]?.[x]===o){a.push([y,x]);y+=d;x+=e}if(a.length&&b[y]?.[x]===col)a.forEach(([q,w])=>b[q][w]=col)}return true}
function moves(b,col){const a=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(can(b,r,c,col))a.push([r,c]);return a}
const CARDS={
 spark:['スパーク','1','敵石1個を消す','enemy'],bomb:['爆裂弾','2','指定マス周囲を消す','any'],shield:['シールド','1','次の相手カードを1回無効化','none'],mirror:['ミラー','2','盤面を左右反転','none'],swap:['強奪','2','敵石1個を自分の石へ','enemy'],revive:['蘇生','2','空きマス1個を自分の石へ','empty'],freeze:['フリーズ','2','相手の次ターンのエネルギー獲得を止める','none'],drain:['ドレイン','2','敵HPを2奪う','none'],heal:['リペア','2','自分HPを3回復','none'],draw:['ドロー','1','カードを2枚追加','none'],wild:['ワイルド','3','空きマスをランダムに3個自分の石へ','none'],quake:['地殻変動','3','全石を1マスランダム移動','none'],flip:['強制反転','2','敵石最大3個を自分の石へ','none'],double:['ダブル','3','次に置く石を2個置く','none'],curse:['カース','2','敵の手札を1枚捨てる','none'],overload:['オーバーロード','0','HPを2失いエネルギー+3','none'],portal:['ポータル','3','指定マスと対角マスを入替','any'],jam:['ジャム','2','敵の次カードコスト+2','none'],echo:['エコー','2','直前に使ったカードを再発動','none'],meteor:['メテオ','4','3×3を消し、中心を自分色に','any'],fortify:['要塞化','2','自分の石3個を保護','none'],sniper:['スナイプ','3','敵石1個を消しHP-1','enemy'],growth:['グロース','2','自分石1個の隣を自分色に','own'],chaos:['カオス','4','盤面を大混乱','none'],steal:['スティール','3','敵手札を1枚奪う','none'],reset:['リセット','4','中央4マスを初期化','none'],tax:['徴税','1','敵エネルギー-2','none'],mirrorhand:['ミラーハンド','2','敵手札をランダム化','none']};
const ids=Object.keys(CARDS);
function fresh(){const deck=[...ids,...ids.slice(0,5)].sort(()=>Math.random()-.5);return{board:board(),turn:1,players:[],hands:[[],[]],decks:[[],[]],energy:[3,3],hp:[20,20],shield:[false,false],freeze:[false,false],jam:[0,0],double:[false,false],last:[null,null],finished:false,turnNo:1,deckSeeds:[deck.slice(),deck.slice()]}}
function setup(r,i){const d=r.deckSeeds[i].slice();r.hands[i]=d.splice(0,5);r.decks[i]=d}
function score(r){r.scores=[r.board.flat().filter(x=>x===1).length,r.board.flat().filter(x=>x===2).length]}
function pub(r){return{type:'state',board:r.board,turn:r.turn,turnNo:r.turnNo,hands:r.hands,scores:r.scores,energy:r.energy,hp:r.hp,players:r.players.map(p=>({name:p.name,color:p.color})),finished:r.finished}}
function endTurn(r){const cur=r.turn; if(!r.freeze[cur-1])r.energy[cur-1]=Math.min(8,r.energy[cur-1]+1); r.turn=3-cur;r.turnNo++; if(!moves(r.board,r.turn).length){if(!moves(r.board,3-r.turn).length){r.finished=true;score(r);broadcast(r,{type:'result',counts:r.scores,hp:r.hp,winner:r.hp[0]===r.hp[1]?0:(r.hp[0]>r.hp[1]?1:2)});return}r.turn=3-r.turn} }
function target(s,id,cell){const [name,cost,desc,t]=CARDS[id];if(t==='none')return true;return Array.isArray(cell)&&cell.length===2}
function use(r,p,id,cell){const i=p.color-1,o=1-i,c=CARDS[id];if(!c||r.hands[i].indexOf(id)<0)return 'カードがありません。';let cost=+c[1]+r.jam[i];if(r.energy[i]<cost)return 'エネルギー不足です。';if(!target(null,id,cell))return '対象マスを選んでください。';const b=r.board, col=p.color, enemy=3-col;let ok=true;
 if(id==='spark'||id==='sniper'){const [a,d]=cell;if(b[a]?.[d]!==enemy)ok=false;else{b[a][d]=0;if(id==='sniper')r.hp[o]-=1}}
 else if(id==='bomb'){const[a,d]=cell;for(let y=a-1;y<=a+1;y++)for(let x=d-1;x<=d+1;x++)if(b[y]?.[x])b[y][x]=0}
 else if(id==='shield')r.shield[i]=true; else if(id==='mirror')r.board=b.map(row=>row.slice().reverse());
 else if(id==='swap'){const[a,d]=cell;if(b[a]?.[d]!==enemy)ok=false;else b[a][d]=col}
 else if(id==='revive'){const[a,d]=cell;if(b[a]?.[d]!==0)ok=false;else b[a][d]=col}
 else if(id==='freeze')r.freeze[o]=true; else if(id==='drain'){r.hp[o]=Math.max(0,r.hp[o]-2);r.hp[i]=Math.min(20,r.hp[i]+2)}
 else if(id==='heal')r.hp[i]=Math.min(20,r.hp[i]+3); else if(id==='draw'){for(let k=0;k<2;k++)if(r.decks[i].length)r.hands[i].push(r.decks[i].shift())}
 else if(id==='wild'){let e=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(!b[y][x])e.push([y,x]);e.sort(()=>Math.random()-.5).slice(0,3).forEach(([y,x])=>b[y][x]=col)}
 else if(id==='quake'){let old=b.map(x=>x.slice());r.board=Array.from({length:8},()=>Array(8).fill(0));for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(old[y][x]){let ny=Math.max(0,Math.min(7,y+(Math.random()*3|0)-1)),nx=Math.max(0,Math.min(7,x+(Math.random()*3|0)-1));r.board[ny][nx]=old[y][x]}}
 else if(id==='flip'){let e=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(b[y][x]===enemy)e.push([y,x]);e.sort(()=>Math.random()-.5).slice(0,3).forEach(([y,x])=>b[y][x]=col)}
 else if(id==='double')r.double[i]=true; else if(id==='curse'){if(r.hands[o].length){r.hands[o].splice(Math.random()*r.hands[o].length|0,1);if(r.decks[o].length)r.hands[o].push(r.decks[o].shift())}}
 else if(id==='overload'){r.hp[i]=Math.max(0,r.hp[i]-2);r.energy[i]=Math.min(8,r.energy[i]+3)}
 else if(id==='portal'){const[a,d]=cell, q=7-a,w=7-d;[b[a][d],b[q][w]]=[b[q][w],b[a][d]]}
 else if(id==='jam')r.jam[o]+=2; else if(id==='echo'){const prev=r.last[i];if(!prev)ok=false;else{r.energy[i]+=+CARDS[prev][1]; use(r,p,prev,r.lastCell[i])}}
 else if(id==='meteor'){const[a,d]=cell;for(let y=a-1;y<=a+1;y++)for(let x=d-1;x<=d+1;x++)if(b[y]?.[x])b[y][x]=0;if(b[a]?.[d]!==undefined)b[a][d]=col}
 else if(id==='fortify'){r.shield[i]=true} else if(id==='growth'){const[a,d]=cell;if(b[a]?.[d]!==col)ok=false;else{const ns=dirs.filter(([dy,dx])=>b[a+dy]?.[d+dx]===0)[0];if(ns)b[a+ns[0]][d+ns[1]]=col}}
 else if(id==='chaos'){let e=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(b[y][x])e.push([y,x]);e.sort(()=>Math.random()-.5).slice(0,10).forEach(([y,x])=>b[y][x]=3-b[y][x])}
 else if(id==='steal'){if(r.hands[o].length){const k=Math.random()*r.hands[o].length|0;r.hands[i].push(r.hands[o].splice(k,1)[0])}}
 else if(id==='reset'){for(let y=2;y<6;y++)for(let x=2;x<6;x++)b[y][x]=0;b[3][3]=2;b[4][4]=2;b[3][4]=1;b[4][3]=1}
 else if(id==='tax')r.energy[o]=Math.max(0,r.energy[o]-2); else if(id==='mirrorhand')r.hands[o].sort(()=>Math.random()-.5);
 if(!ok)return 'その対象には使えません。';r.energy[i]-=cost;r.hands[i].splice(r.hands[i].indexOf(id),1);if(r.decks[i].length)r.hands[i].push(r.decks[i].shift());r.last[i]=id;r.lastCell=r.lastCell||[];r.lastCell[i]=cell;score(r);if(r.hp[o]<=0)r.finished=true;return null}
function handle(r,p,m){if(r.finished||r.players.length<2)return;if(m.type==='card'&&r.turn===p.color){const e=use(r,p,m.id,m.cell);if(e)return send(p.ws,{type:'error',message:e});broadcast(r,pub(r));return}if(m.type==='place'&&r.turn===p.color){let [a,d]=m.cell||[];if(!can(r.board,a,d,p.color))return send(p.ws,{type:'error',message:'そこには置けません。'});put(r.board,a,d,p.color);if(r.double[p.color-1]){r.double[p.color-1]=false;let opts=moves(r.board,p.color);if(opts.length){}else endTurn(r)}else endTurn(r);score(r);broadcast(r,pub(r));}}
const server=http.createServer((req,res)=>{let f=req.url==='/'?'/index.html':req.url;const fp=path.normalize(path.join(publicDir,f));if(!fp.startsWith(publicDir))return res.end('forbidden');fs.readFile(fp,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found')}const t={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(fp)]||'application/octet-stream';res.writeHead(200,{'Content-Type':t});res.end(d)})});
const wss=new WebSocketServer({server});wss.on('connection',ws=>{let r,p;ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}if(m.type==='join'){const code=(m.room||Math.random().toString(36).slice(2,8)).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);r=rooms.get(code)||fresh();rooms.set(code,r);if(r.players.length>=2)return send(ws,{type:'error',message:'満員です。'});p={ws,name:String(m.name||'Player').slice(0,12),color:r.players.length+1};r.players.push(p);setup(r,p.color-1);send(ws,{type:'joined',room:code,color:p.color});broadcast(r,pub(r))}else if(r&&p)handle(r,p,m)});ws.on('close',()=>{if(r&&p){r.players=r.players.filter(x=>x!==p);if(!r.players.length)for(const[k,v]of rooms)if(v===r)rooms.delete(k)}})});server.listen(PORT,()=>console.log(`REVERSI: CHAOS DECK v0.2 on ${PORT}`));
