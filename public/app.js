const $ = id => document.getElementById(id);
const number = value => new Intl.NumberFormat("pt-BR").format(Number(value || 0));
function message(text=""){ $("message").textContent=text; }
async function api(url, options={}) {
  const response=await fetch(url,{credentials:"same-origin",...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "Ocorreu um erro.");
  return data;
}
async function loadDashboard(){
  try{
    const status=await api("/api/status");
    $("connection-status").textContent=status.connected?"Canal conectado":"Não conectado";
    if(!status.configured){
      $("setup-hint").textContent="A configuração do Google Cloud será feita na próxima etapa.";
      return;
    }
    if(!status.connected) return;
    $("dashboard").classList.remove("hidden");
    $("connect-button").classList.add("hidden");
    const channel=await api("/api/channel");
    $("channel-title").textContent=channel.title;
    $("channel-description").textContent=channel.description||"";
    $("channel-thumbnail").src=channel.thumbnail||"";
    $("subscribers").textContent=number(channel.subscribers);
    $("views").textContent=number(channel.views);
    $("videos").textContent=number(channel.videos);
    const analytics=await api("/api/analytics");
    $("analytics-period").textContent=analytics.startDate+" a "+analytics.endDate;
    const totals=(analytics.rows||[]).reduce((a,row)=>({
      views:a.views+Number(row[1]||0),
      minutes:a.minutes+Number(row[2]||0),
      subs:a.subs+Number(row[4]||0)
    }),{views:0,minutes:0,subs:0});
    $("period-views").textContent=number(totals.views);
    $("watch-time").textContent=number(Math.round(totals.minutes));
    $("gained-subs").textContent=number(totals.subs);
    const subscribers=Number(channel.subscribers||0);
    const watchHours=Number(analytics.watchHours365||0);
    const percent=(value,target)=>Math.min(100,Math.max(0,(value/target)*100));
    const updateGoal=(prefix,value,target,suffix)=>{
      $(prefix+"-label").textContent=number(Math.floor(value))+" / "+number(target)+" "+suffix;
      $(prefix+"-progress").style.width=percent(value,target)+"%";
      $(prefix+"-detail").textContent=value>=target?"Meta numérica alcançada. Confira os demais requisitos no YouTube Studio.":"Faltam aproximadamente "+number(Math.max(0,Math.ceil(target-value)))+" "+suffix+".";
    };
    updateGoal("early-subs",subscribers,500,"inscritos");
    updateGoal("early-hours",watchHours,3000,"horas");
    updateGoal("ads-subs",subscribers,1000,"inscritos");
    updateGoal("ads-hours",watchHours,4000,"horas");
    const videoReport=await api("/api/top-videos");
    $("videos-period").textContent=videoReport.startDate+" a "+videoReport.endDate;
    const list=$("top-videos");
    list.replaceChildren();
    if(!videoReport.videos.length){
      const empty=document.createElement("p");
      empty.className="muted";
      empty.textContent="Ainda não há dados suficientes de desempenho para os vídeos neste período.";
      list.appendChild(empty);
    } else {
      videoReport.videos.forEach((video,index)=>{
        const card=document.createElement("article");
        card.className="video-item";
        const img=document.createElement("img");
        img.src=video.thumbnail;
        img.alt="";
        const content=document.createElement("div");
        content.className="video-content";
        const title=document.createElement("b");
        title.textContent=(index+1)+". "+video.title;
        const stats=document.createElement("p");
        stats.className="muted";
        const avg=Math.floor(video.averageViewDuration||0);
        const avgText=Math.floor(avg/60)+":"+String(avg%60).padStart(2,"0");
        stats.textContent=number(video.views)+" visualizações  •  "+number(video.watchHours)+" horas assistidas  •  média "+avgText+"  •  CTR "+(Number(video.clickThroughRate||0)*100).toFixed(1).replace(".",",")+"%";
        content.append(title,stats);
        card.append(img,content);
        list.appendChild(card);
      });
    }
    message("");
  }catch(error){message(error.message);}
}
$("connect-button").addEventListener("click",()=>location.href="/auth/google");
$("refresh-button").addEventListener("click",loadDashboard);
$("disconnect-button").addEventListener("click",async()=>{
  await api("/auth/logout",{method:"POST"});
  location.reload();
});
const params=new URLSearchParams(location.search);
if(params.has("auth")) history.replaceState({},document.title,"/");
loadDashboard();
