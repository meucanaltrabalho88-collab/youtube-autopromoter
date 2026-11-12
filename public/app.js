
function renderDiagnosis(rows, totals, videos){
  const container = $("diagnosis-content");
  if (!container) return;
  container.replaceChildren();
  const addInsight = (type, title, description) => {
    const item = document.createElement("article");
    item.className = "diagnosis-item " + type;
    const heading = document.createElement("b");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = description;
    item.append(heading, body);
    container.appendChild(item);
  };

  if (!rows.length || !totals.views) {
    addInsight("neutral", "Ainda faltam dados para um diagnóstico", "Publique conteúdo e aguarde o processamento do YouTube Analytics. Depois, atualize o painel para receber recomendações baseadas no desempenho.");
    return;
  }

  const firstHalf = rows.slice(0, 14);
  const secondHalf = rows.slice(14);
  const sumViews = part => part.reduce((sum, row) => sum + Number(row[1] || 0), 0);
  const firstViews = sumViews(firstHalf);
  const secondViews = sumViews(secondHalf);
  if (firstHalf.length >= 7 && secondHalf.length >= 7) {
    if (firstViews > 0) {
      const change = ((secondViews - firstViews) / firstViews) * 100;
      if (change >= 10) {
        addInsight("positive", "As visualizações estão em alta", "A segunda metade do período teve " + Math.round(change) + "% mais visualizações que a primeira. Identifique os temas e formatos publicados nesse intervalo e teste novas abordagens semelhantes.");
      } else if (change <= -10) {
        addInsight("attention", "As visualizações perderam ritmo", "A segunda metade do período teve " + Math.abs(Math.round(change)) + "% menos visualizações. Revise os temas, títulos e miniaturas recentes e compare o resultado no YouTube Studio.");
      } else {
        addInsight("neutral", "Visualizações relativamente estáveis", "A diferença entre as duas metades do período ficou em " + Math.round(change) + "%. Experimente novos ângulos para os temas que já demonstraram interesse do público.");
      }
    } else if (secondViews > 0) {
      addInsight("positive", "O canal começou a registrar visualizações", "A primeira metade não teve visualizações registradas e a segunda teve " + number(secondViews) + ". Acompanhe os próximos períodos para confirmar se esse avanço se mantém.");
    }
  } else {
    addInsight("neutral", "Histórico ainda curto", "Há poucos dias com dados suficientes para comparar tendências. Continue publicando e volte a analisar quando houver uma série mais completa.");
  }

  const avgSeconds = rows.reduce((sum,row)=>sum + Number(row[1]||0)*Number(row[3]||0),0) / Math.max(1,totals.views);
  const avgText = Math.floor(avgSeconds/60) + ":" + String(Math.floor(avgSeconds%60)).padStart(2,"0");
  if (avgSeconds > 0) {
    addInsight("neutral", "Tempo médio assistido: " + avgText, "Use esse valor como referência geral do período. Compare-o com a duração de cada vídeo no YouTube Studio para avaliar se a abertura entrega rapidamente o que o título e a miniatura prometem.");
  }

  const conversion = totals.views ? (totals.subs / totals.views) * 1000 : 0;
  if (totals.views >= 100) {
    addInsight(conversion >= 3 ? "positive" : "attention", "Conversão aproximada em inscritos: " + conversion.toFixed(1).replace(".", ",") + " por mil visualizações", conversion >= 3
      ? "O canal está convertendo parte dos espectadores em inscritos. Mantenha chamadas para inscrição naturais e ligadas ao valor entregue pelo conteúdo."
      : "Há espaço para transformar mais espectadores em inscritos. Explique com clareza o que a pessoa encontrará no canal e convide-a a acompanhar os próximos debates.");
  }

  if (videos.length) {
    const totalVideoHours = videos.reduce((sum,video)=>sum+Number(video.watchHours||0),0);
    const leading = videos[0];
    const share = totalVideoHours ? (Number(leading.watchHours||0)/totalVideoHours)*100 : 0;
    if (share >= 35) {
      addInsight("positive", "Um vídeo se destaca no tempo assistido", "“" + leading.title + "” representa aproximadamente " + Math.round(share) + "% do tempo assistido somado dos vídeos exibidos no ranking. Considere criar um novo conteúdo que aprofunde o assunto, sem repetir o mesmo vídeo.");
    } else {
      addInsight("neutral", "O desempenho está distribuído entre vários vídeos", "Nenhum vídeo concentra sozinho grande parte do tempo assistido no ranking. Compare os temas dos primeiros colocados e procure padrões que possam orientar os próximos conteúdos.");
    }
  }

  addInsight("neutral", "Próxima verificação importante", "CTR de impressões e retenção detalhada não estão disponíveis nesta análise automática. Consulte essas métricas no YouTube Studio antes de decidir trocar miniaturas ou editar a estrutura dos vídeos.");
}

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
        stats.textContent=number(video.views)+" visualizações  •  "+number(video.watchHours)+" horas assistidas  •  média "+avgText+"  •  CTR: consulte no YouTube Studio";
        content.append(title,stats);
        card.append(img,content);
        list.appendChild(card);
      });
    }
    renderDiagnosis(analytics.rows || [], totals, videoReport.videos || []);
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
