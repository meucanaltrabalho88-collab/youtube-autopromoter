
function renderVideoIdeas(videos){
  const container = $("video-ideas");
  if (!container) return;
  container.replaceChildren();
  if (!videos.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Quando houver vídeos com desempenho no período, o painel sugerirá novos ângulos de conteúdo.";
    container.appendChild(empty);
    return;
  }
  const ideas = [
    {tag:"Aprofundamento",make:title=>"O que ainda precisamos entender sobre: " + title,why:"Aprofunde o assunto que já demonstrou capacidade de gerar tempo de exibição."},
    {tag:"Debate",make:title=>"O outro lado da história: " + title,why:"Apresente argumentos diferentes e convide a audiência a participar com respeito."},
    {tag:"Continuação",make:title=>"As perguntas que ficaram depois de: " + title,why:"Transforme dúvidas e comentários do público em uma continuação útil."}
  ];
  videos.slice(0,3).forEach((video,index)=>{
    const idea=ideas[index];
    const card=document.createElement("article");
    card.className="idea-item";
    const tag=document.createElement("span");
    tag.className="idea-tag";
    tag.textContent=idea.tag+" · Inspirado em: "+video.title;
    const heading=document.createElement("b");
    heading.textContent=idea.make(video.title);
    const detail=document.createElement("p");
    detail.textContent=idea.why+" Referência: este vídeo está entre os que mais geraram tempo de exibição nos últimos 28 dias.";
    const copy=document.createElement("button");
    copy.className="secondary idea-copy";
    copy.type="button";
    copy.textContent="Copiar ideia";
    copy.addEventListener("click",async()=>{
      try{
        await navigator.clipboard.writeText(idea.make(video.title));
        copy.textContent="Copiado!";
      }catch(e){
        copy.textContent="Selecione e copie o título";
      }
    });
    card.append(tag,heading,detail,copy);
    container.appendChild(card);
  });
  const note=document.createElement("p");
  note.className="hint";
  note.textContent="Estas são sugestões automáticas de pauta, não previsões de desempenho. Valide o interesse do público nos comentários e no YouTube Studio antes de produzir.";
  container.appendChild(note);
}

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


let activeChannelId = "";
function profileStorageKey(){ return "ytap-editorial-profile:" + (activeChannelId || "default"); }
function getEditorialProfile(){
  try { return JSON.parse(localStorage.getItem(profileStorageKey()) || "{}"); }
  catch(e){ return {}; }
}
function loadEditorialProfile(){
  const p=getEditorialProfile();
  $("profile-niche").value=p.niche||"";
  $("profile-audience").value=p.audience||"";
  $("profile-style").value=p.style||"";
  $("profile-themes").value=p.themes||"";
  $("profile-avoid").value=p.avoid||"";
  $("profile-status").textContent="Perfil associado ao canal conectado.";
}
function saveEditorialProfile(){
  const p={
    niche:$("profile-niche").value.trim(),
    audience:$("profile-audience").value.trim(),
    style:$("profile-style").value.trim(),
    themes:$("profile-themes").value.trim(),
    avoid:$("profile-avoid").value.trim()
  };
  if(!p.niche && !p.audience && !p.style && !p.themes && !p.avoid){
    $("profile-status").textContent="Preencha pelo menos o nicho ou o estilo do canal.";
    return;
  }
  localStorage.setItem(profileStorageKey(),JSON.stringify(p));
  $("profile-status").textContent="Identidade editorial salva para este canal.";
}
function renderSEO(){
  const profile=getEditorialProfile();
  const topic=$("seo-topic").value.trim();
  const keyword=$("seo-keyword").value.trim();
  const script=$("seo-script").value.trim();
  const output=$("seo-results");
  output.replaceChildren();
  if(!script || script.length < 250){
    output.textContent="Cole o roteiro completo (mínimo de 250 caracteres) para que a análise tenha contexto suficiente.";
    return;
  }

  const stopWords=new Set(("a o as os um uma uns umas de da do das dos em no na nos nas por para com sem sob sobre entre e ou mas que se sua seu suas seus isso isto esse essa este esta ao aos à às como mais menos muito muita muitos muitas já também não sim ser estar ter foi são era eram será vai vão pode podem deve devem porque quando onde qual quais quem todo toda todos todas cada outro outra outros outras mesmo mesma mesmos mesmas pelo pela pelos pelas até após antes durante então assim apenas ainda aqui ali ele ela eles elas nós vocês eu me meu minha meus minhas você canal vídeo vídeos conteúdo conteúdos tema assunto debate reflexão opinião análise").split(/\s+/));

  const clean=s=>s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
  const words=clean(script).split(" ").filter(w=>w.length>3&&!stopWords.has(w));
  const counts=new Map();
  words.forEach(w=>counts.set(w,(counts.get(w)||0)+1));
  const ranked=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const uniquePhrases=[];
  const sentences=script.replace(/\s+/g," ").split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s.length>35);
  const firstSentences=sentences.slice(0,3);
  const questionSentences=sentences.filter(s=>s.includes("?"));
  const key=keyword||ranked[0]||topic;
  const niche=profile.niche||"";
  const audience=profile.audience||"";
  const style=profile.style||"";
  const profileThemes=(profile.themes||"").split(",").map(v=>v.trim()).filter(Boolean);
  const avoid=(profile.avoid||"").trim();
  const related=ranked.filter(w=>clean(w)!==clean(key)).slice(0,8);
  const titleTopic=topic||key;
  const titleOptions=[
    titleTopic+"? A história por trás do assunto",
    "O que pouca gente sabe sobre "+(titleTopic||key),
    (key||titleTopic)+": uma resenha com histórias e detalhes que merecem atenção"
  ];
  if(niche.toLowerCase().includes("futebol") || profileThemes.some(t=>/jogador|bastidor|resenha|futebol|hist.ria engra/i.test(t))){
    titleOptions[0]=(topic||key)+"? A história que está por trás dessa resenha";
    titleOptions[1]="O bastidor e os detalhes que pouca gente conhece sobre "+(topic||key);
    titleOptions[2]="A resenha é boa, mas essa história é melhor: "+(topic||key);
  }
  if(questionSentences.length){
    const q=questionSentences[0].replace(/[“”"]/g,"").trim();
    titleOptions[0]=q.length<=78?q:titleOptions[0];
  }
  const intro=firstSentences.join(" ");
  const summary=sentences.length>3?sentences.slice(3,6).join(" "):"Neste vídeo, examinamos diferentes pontos de vista, os argumentos apresentados e as consequências desse tema.";
  const description=(niche?"Conteúdo do canal sobre "+niche+". ":"")+
    (style?"Em uma linguagem "+style+", ":"")+
    (audience?"Pensado para "+audience+". ":"")+
    (topic?"Neste vídeo, o tema central é "+topic+". ":"")+
    (intro?intro+" ":"")+
    (summary?summary+" ":"")+
    "\n\nA proposta é olhar para o assunto com senso crítico, considerar os diferentes lados e separar opiniões de argumentos. "+
    (questionSentences.length?"Uma das perguntas que orientam a discussão é: "+questionSentences[0]:"Qual argumento faz mais sentido para você?")+
    "\n\nDeixe sua opinião nos comentários e participe do debate. Se este tipo de conteúdo interessa a você, inscreva-se no canal para acompanhar os próximos vídeos.";
  const tags=[...new Set([key,...related,...(topic?clean(topic).split(" ").filter(w=>w.length>3&&!stopWords.has(w)):[]),...profileThemes,...(niche?[niche]:[]),"debate","opinião"].map(v=>v.trim()).filter(Boolean))].slice(0,20);
  const hashtags=[...new Set([key,...related.slice(0,2),...profileThemes.slice(0,1),niche].map(v=>v.replace(/[^a-z0-9]/gi,"")).filter(Boolean))].slice(0,5).map(v=>"#"+v).join(" ");
  const addResult=(label,value)=>{
    const section=document.createElement("div"); section.className="seo-result";
    const heading=document.createElement("b"); heading.textContent=label;
    const content=document.createElement("p"); content.className="seo-copy-text"; content.textContent=value;
    const button=document.createElement("button"); button.className="secondary"; button.type="button"; button.textContent="Copiar";
    button.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(value);button.textContent="Copiado!";}catch(e){button.textContent="Copie manualmente";}});
    section.append(heading,content,button); output.appendChild(section);
  };
  addResult("3 títulos baseados no roteiro",titleOptions.map((v,i)=>(i+1)+". "+v).join("\n\n"));
  addResult("Descrição contextualizada",description+"\n\n"+hashtags);
  addResult("Palavras-chave extraídas do roteiro",tags.join(", "));
  const note=document.createElement("p"); note.className="hint";
  note.textContent="A análise combina o roteiro com a identidade editorial salva para este canal. "+(avoid?"Evite enquadramentos ligados a: "+avoid+". ":"")+"Revise os títulos para garantir que representem fielmente o vídeo. As tags são apoio contextual; título, miniatura, retenção e satisfação do público têm maior peso.";
  output.appendChild(note);
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
    activeChannelId=channel.id||channel.title||"default";
    loadEditorialProfile();
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
    renderVideoIdeas(videoReport.videos || []);
    message("");
  }catch(error){message(error.message);}
}
$("connect-button").addEventListener("click",()=>location.href="/auth/google");
$("refresh-button").addEventListener("click",loadDashboard);
$("seo-generate").addEventListener("click",renderSEO);
$("profile-save").addEventListener("click",saveEditorialProfile);
$("disconnect-button").addEventListener("click",async()=>{
  await api("/auth/logout",{method:"POST"});
  location.reload();
});
const params=new URLSearchParams(location.search);
if(params.has("auth")) history.replaceState({},document.title,"/");
loadDashboard();
