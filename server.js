const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const PORT=process.env.PORT||8787, ROOT=path.join(__dirname,".."), DECK=JSON.parse(fs.readFileSync(path.join(__dirname,"cards.json")));
const rooms=new Map();
function newRoom(){return {players:["A"],profiles:{},round:0,idx:0,answers:{},score:{A:0,B:0},drinks:0,level:1,intensity:1,stats:{A:{answers:0,rolls:0,truths:0},B:{answers:0,rolls:0,truths:0}},matches:0,compared:0}}
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
function send(res,o,status=200){res.writeHead(status,{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type"});res.end(JSON.stringify(o))}
function body(req,cb){let s="";req.on("data",d=>s+=d);req.on("end",()=>cb(s?JSON.parse(s):{}))}
function card(r){let base=DECK.cards[r.idx%DECK.cards.length];return r.level>=9 && r.idx%5===4 ? DECK.finalCards[r.idx%DECK.finalCards.length] : base}
const challenges=[["🔥","Reto","20 segundos de mirada; después, una palabra cada uno."],["🍷","Reto","Brindis por una cosa buena de esta noche. La bebida puede sustituirse por una acción sin alcohol."],["👂","Reto","Decid al oído una cosa que os atraiga del otro."],["💃","Reto","Baile juntos durante una canción."],["🎯","Reto","Adivina qué respuesta dará el otro en la próxima carta."]];
const closeness=[["🫶","Cercanía","Lado a lado durante una carta."],["👀","Cercanía","Frente a frente, mirada 20 segundos."],["🫂","Cercanía","Abrazo de 20 segundos, si ambos queréis."],["💃","Cercanía","Baile lento y cercano, siempre cómodo para ambos."]];
const erotic=[["❤️‍🔥","Final sensual","Elegid juntos: mirada, baile, susurro o abrazo."],["🎲","Dado sensual","1 mirada · 2 baile · 3 susurro · 4 abrazo · 5 el otro elige · 6 reto sensual de pareja."]];
const srv=http.createServer((req,res)=>{
 const u=new URL(req.url,"http://x"),p=u.pathname.split("/").filter(Boolean);
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type"});return res.end()}
 if(req.method==="GET"&&p[0]==="health"){return send(res,{ok:true,service:"sin-escapatoria",version:"4.0"})}
 if(req.method==="GET" && (p.length===0||p[0]==="index.html")){let f=fs.readFileSync(path.join(ROOT,"web/index.html"));res.writeHead(200,{"Content-Type":"text/html"});return res.end(f)}
 if(req.method==="GET"&&p[0]==="manifest.json"){res.writeHead(200,{"Content-Type":"application/json"});return res.end(fs.readFileSync(path.join(ROOT,"web/manifest.json")))}
 if(req.method==="POST"&&p[0]==="room"){let c=code();rooms.set(c,newRoom());return send(res,{ok:true,code:c,player:"A"})}
 if(req.method==="POST"&&p[0]==="profile"){let r=rooms.get(p[1]);return body(req,x=>{if(r&&r.players.includes(x.player))r.profiles[x.player]=x.profile;send(res,{ok:true})})}
 if(req.method==="POST"&&p[0]==="join"){let r=rooms.get(p[1]);if(!r)return send(res,{ok:false,error:"No existe esa partida"},404);if(r.players.length>=2)return send(res,{ok:false,error:"La partida ya tiene dos jugadores"},409);r.players.push("B");return send(res,{ok:true,player:"B"})}
 if(p[0]==="summary"){let r=rooms.get(p[1]);if(!r)return send(res,{ok:false},404);let totalScore=r.score.A+r.score.B,totalRolls=r.stats.A.rolls+r.stats.B.rolls;return send(res,{ok:true,rounds:r.round,level:r.level,totalScore,totalRolls,matchPercent:r.compared?Math.round(r.matches/r.compared*100):0,players:{A:r.profiles.A||"Mirella",B:r.profiles.B||"Pedro"}})}
 if(p[0]==="state"){let r=rooms.get(p[1]),pl=u.searchParams.get("player");if(!r)return send(res,{ok:false},404);return send(res,{ok:true,players:r.players.length,round:r.round,level:r.level,intensity:r.intensity,drinks:r.drinks,score:r.score[pl]||0,profile:r.profiles[pl]||null,stats:r.stats[pl],card:card(r),myAnswer:r.answers[pl]??null})}
 if(req.method==="POST"&&p[0]==="answer"){let r=rooms.get(p[1]);return body(req,x=>{if(!r||!r.players.includes(x.player))return send(res,{ok:false},404);r.answers[x.player]=x.answer;r.score[x.player]+=2;r.stats[x.player].answers++;
 if(Object.keys(r.answers).length===2){let vals=Object.values(r.answers);if(vals[0]===vals[1]){r.score.A++;r.score.B++;r.matches++;} r.compared++;if(vals.includes(0))r.drinks++;r.idx++;r.round++;r.level=Math.min(10,1+Math.floor(r.round/3));r.intensity=r.level;r.answers={}}send(res,{ok:true})})}
 if(req.method==="POST"&&["die","challenge","closeness"].includes(p[0])){let r=rooms.get(p[1]);if(!r)return send(res,{ok:false},404);
 if(p[0]==="die"){let pl=u.searchParams.get("player")||"A";r.stats[pl].rolls++;let n=1+Math.floor(Math.random()*6);let text;if(r.level>=9)text=["Mirada 20 s","Baile","Susurro","Abrazo","El otro elige","Reto sensual de pareja"][n-1];else text=["Bebida","Mirada","Abrazo","Susurro","Baile","Reto"][n-1];if(n===1)r.drinks++;return send(res,{ok:true,icon:"🎲",title:r.level>=9?"Dado final":"Dado",text:"Ha salido "+n+": "+text})}
if(p[0]==="challenge"){let pool=r.level>=9?challenges.concat(erotic):challenges;let x=pool[Math.floor(Math.random()*pool.length)];return send(res,{ok:true,icon:x[0],title:x[1],text:x[2]})}
let x=closeness[Math.floor(Math.random()*closeness.length)];return send(res,{ok:true,icon:x[0],title:x[1],text:x[2]})}
send(res,{ok:false,error:"Ruta no encontrada"},404)
});
process.on('SIGTERM',()=>srv.close(()=>process.exit(0)));
srv.listen(PORT,'0.0.0.0',()=>console.log("Sin Escapatoria online en puerto "+PORT));