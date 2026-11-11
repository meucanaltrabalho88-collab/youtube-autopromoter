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
