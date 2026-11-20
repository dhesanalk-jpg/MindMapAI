import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Brain, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleHelp, Clock3, Command, FileText,
  Flame, Gauge, GraduationCap, HelpCircle, LayoutDashboard, ListChecks,
  Map, Menu, MoreHorizontal, Plus, RefreshCw, Search, Settings2, Sparkles,
  Target, Timer, UploadCloud, WandSparkles, X, Zap
} from 'lucide-react'
import { analyzeFile, buildPlan, checkHealth, makeQuestions, rescuePlan } from './lib/api'
import type { Question, Session, Topic } from './types'

type Page = 'Overview' | 'Knowledge map' | 'Study planner' | 'Practice lab' | 'Progress' | 'Settings'
const seedTopics: Topic[] = []
const initialSessions: Session[] = []
const nav: {name:Page;icon:any}[] = [
  {name:'Overview',icon:LayoutDashboard},{name:'Knowledge map',icon:Map},{name:'Study planner',icon:CalendarDays},{name:'Practice lab',icon:Brain},{name:'Progress',icon:Activity},{name:'Settings',icon:Settings2}
]
const readStore = <T,>(key:string, fallback:T):T => {
  try { const value=localStorage.getItem(key); return value?JSON.parse(value) as T:fallback } catch { return fallback }
}
const readTopics = ():Topic[] => {
  const saved=readStore<Topic[]>('mindmap-topics',[])
  // Remove the original bundled DBMS demo records during the first upgraded launch.
  if(saved.length && saved.every(t=>/^t[1-8]$/.test(t.id))){localStorage.removeItem('mindmap-topics');localStorage.removeItem('mindmap-sessions');localStorage.removeItem('mindmap-done');return []}
  return saved
}
function App() {
  const [page,setPage] = useState<Page>('Overview')
  const [topics,setTopics] = useState<Topic[]>(()=>readTopics())
  const [sourceText,setSourceText] = useState<string>(()=>readStore('mindmap-source-text',''))
  const [sessions,setSessions] = useState<Session[]>(()=>readStore('mindmap-sessions',initialSessions))
  const [done,setDone] = useState<string[]>(()=>readStore('mindmap-done',[]))
  const [examDate,setExamDate] = useState(()=>readStore('mindmap-exam-date',new Date(Date.now()+30*86400000).toISOString().slice(0,10)))
  const [hours,setHours] = useState(()=>readStore('mindmap-study-hours',2))
  const [fileBusy,setFileBusy] = useState(false)
  const [notice,setNotice] = useState('')
  const [apiStatus,setApiStatus] = useState('Checking')
  const [aiStatus,setAiStatus] = useState('Unknown')
  const [editor,setEditor] = useState<Topic|null|false>(false)
  const [draft,setDraft] = useState({title:'',subject:'',unit:'Unit 1',difficulty:'Medium' as Topic['difficulty'],estimated_hours:1})
  const [query,setQuery] = useState('')
  const [selectedTopic,setSelectedTopic] = useState<Topic|null>(null)
  const [questions,setQuestions] = useState<Question[]>([])
  const [quizBusy,setQuizBusy] = useState(false)
  const [showAnswer,setShowAnswer] = useState<number[]>([])
  const [activeQuestion,setActiveQuestion] = useState('')
  const [mobileOpen,setMobileOpen] = useState(false)
  const [confidence,setConfidence] = useState(3)
  const [showRescue,setShowRescue] = useState(false)
  const [rescue,setRescue] = useState<{day:number;topics:string[];buffer:boolean}[]>([])
  const [focus,setFocus] = useState(false)

  useEffect(()=>{localStorage.setItem('mindmap-topics',JSON.stringify(topics))},[topics])
  useEffect(()=>{localStorage.setItem('mindmap-source-text',sourceText)},[sourceText])
  useEffect(()=>{localStorage.setItem('mindmap-sessions',JSON.stringify(sessions))},[sessions])
  useEffect(()=>{localStorage.setItem('mindmap-done',JSON.stringify(done))},[done])
  useEffect(()=>{localStorage.setItem('mindmap-exam-date',examDate)},[examDate])
  useEffect(()=>{localStorage.setItem('mindmap-study-hours',JSON.stringify(hours))},[hours])
  useEffect(()=>{checkHealth().then((h:any)=>{setApiStatus('Connected');setAiStatus(h.ai_configured?'Configured':'Not configured')}).catch(()=>{setApiStatus('Offline');setAiStatus('Unavailable')})},[])
  const completed = topics.filter(t=>t.status==='completed').length
  const mastery = topics.length ? Math.round(topics.reduce((a,t)=>a+t.confidence,0)/topics.length):0
  const completion = topics.length ? Math.round(completed/topics.length*100):0
  const filtered = topics.filter(t=>t.title.toLowerCase().includes(query.toLowerCase()))
  const today = new Date().toISOString().slice(0,10)
  const todaySessions = sessions.filter(s=>s.date===today)
  const hardTopics = topics.filter(t=>t.difficulty==='Hard' && t.status!=='completed')
  const nextTopic = [...topics].filter(t=>t.status!=='completed').sort((a,b)=>a.confidence-b.confidence)[0]

  const updateTopic = (id:string, patch:Partial<Topic>) => setTopics(prev=>prev.map(t=>t.id===id?{...t,...patch}:t))
  const markDone = (topic:Topic) => {
    updateTopic(topic.id,{status:'completed',confidence:Math.max(topic.confidence,75)})
    setDone(prev=>prev.includes(topic.id)?prev:[...prev,topic.id])
    setNotice(`${topic.title} marked as completed. Nice work.`)
  }
  const upload = async (file?:File) => {
    if(!file) return
    setFileBusy(true); setNotice('')
    try {
      const result = await analyzeFile(file)
      setTopics(result.topics.map((t,i)=>({...t,id:`${Date.now()}-${i}`,confidence:0,status:'not_started' as const})))
      setSourceText(result.source_text||result.preview||'')
      setSessions([]); setDone([])
      setPage('Knowledge map')
      setNotice(`${result.topics.length} topics extracted from ${result.filename}. Review them before planning.`)
    } catch (e) {
      setNotice(e instanceof Error?e.message:'Upload failed. Check that the API is running.')
    } finally { setFileBusy(false) }
  }
  const generatePlan = async () => {
    if(!topics.length){setNotice('Upload a syllabus or add topics before generating a study plan.');setPage('Knowledge map');return}
    try {
      const result = await buildPlan(topics,examDate,hours)
      setSessions(result.sessions)
      setNotice(`Your adaptive plan is ready with ${result.sessions.length} study sessions.`)
    } catch {
      const sorted=[...topics].filter(t=>t.status!=='completed').sort((a,b)=>a.confidence-b.confidence)
      const fallback=sorted.map((t,i)=>({id:`local-${i}`,date:new Date(Date.now()+Math.floor(i/2)*86400000).toISOString().slice(0,10),topic_id:t.id,topic:t.title,duration_hours:t.estimated_hours,type:t.difficulty==='Hard'?'Deep work':'Learn',reason:'Prioritised by difficulty and confidence.'}))
      setSessions(fallback); setNotice('Plan created in local demo mode. Start the API for document-backed scheduling.')
    }
  }
  const generateQuiz = async (topic:Topic) => {
    setSelectedTopic(topic); setQuizBusy(true); setShowAnswer([])
    try {
      const result=await makeQuestions(topic.title,topic.subject,5,sourceText)
      setQuestions(result.questions)
      setActiveQuestion(result.mode==='gemini'?'Gemini-generated questions using your uploaded syllabus text':'Template-based practice prompts; no AI provider response was used')
      setPage('Practice lab')
    } catch {
      setQuestions([{question:`Explain ${topic.title} and give a practical example.`,type:'Short answer',answer:`Define ${topic.title}, explain its key principles, and give a relevant example.`,explanation:'Check your syllabus and notes for the exact terminology.'}])
      setPage('Practice lab')
    } finally {setQuizBusy(false)}
  }
  const runRescue = async () => {
    if(!topics.some(t=>t.status!=='completed')){setNotice('Add unfinished topics before creating a rescue plan.');return}
    try { const r=await rescuePlan(topics.filter(t=>t.status!=='completed'),3); setRescue(r.days) }
    catch { setRescue([1,2,3].map(day=>({day,topics:topics.filter(t=>t.status!=='completed').filter((_,i)=>i%3===day-1).map(t=>t.title),buffer:day===3}))) }
    setShowRescue(true)
  }
  const navTo = (name:Page) => {setPage(name);setMobileOpen(false)}
  const openAdd = () => {setDraft({title:'',subject:topics[0]?.subject||'My subject',unit:'Unit 1',difficulty:'Medium',estimated_hours:1});setEditor(null)}
  const saveTopic = () => {const title=draft.title.trim();if(!title){setNotice('Enter a topic name before saving.');return}if(editor && editor!==false){updateTopic(editor.id,{...draft,title});setNotice('Topic updated.')}else{const t:Topic={...draft,title,id:crypto.randomUUID(),status:'not_started',confidence:0};setTopics(p=>[...p,t]);setNotice('Topic added to your syllabus.')}setEditor(false)}
  const resetDemo = () => {setTopics([]);setSessions([]);setDone([]);setQuestions([]);localStorage.removeItem('mindmap-topics');localStorage.removeItem('mindmap-sessions');localStorage.removeItem('mindmap-done');localStorage.removeItem('mindmap-source-text');setSourceText('');setNotice('Your demo workspace has been cleared. Upload a syllabus or add topics to begin.')}
  const addFromText = (text:string) => {const lines=text.split(/\n|[,;]/).map(x=>x.trim()).filter(x=>x.length>2);const newTopics=lines.map((title,i):Topic=>({id:crypto.randomUUID(),title,subject:topics[0]?.subject||'My subject',unit:`Unit ${Math.floor(i/4)+1}`,difficulty:'Medium',estimated_hours:1,status:'not_started',confidence:0}));setTopics(p=>[...p,...newTopics]);setNotice(`${newTopics.length} topics added.`)}
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen?'sidebar-open':''}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><b>mindmap<span>AI</span></b><small>LEARNING INTELLIGENCE</small></div><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X size={18}/></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <div className="course-switch"><div className="course-icon">{(topics[0]?.subject||'MY').slice(0,2).toUpperCase()}</div><div><b>{topics[0]?.subject||'My workspace'}</b><small>{topics.length} syllabus topics</small></div></div>
      <nav>{nav.filter(item=>item.name!=='Settings').map(item=><button key={item.name} className={`nav-item ${page===item.name?'active':''}`} onClick={()=>navTo(item.name)}><item.icon size={18}/><span>{item.name}</span>{item.name==='Practice lab'&&<span className="nav-new">NEW</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="streak-card"><div className="streak-top"><Flame size={17}/><span>YOUR MOMENTUM</span></div><div className="streak-number">{done.length.toString().padStart(2,'0')} <small>topics completed</small></div><div className="streak-bars">{[1,1,1,0,1,1,1].map((v,i)=><i key={i} className={v?'lit':''}/>)}</div><small>Your progress updates as you study.</small></div>
        <button className={`nav-item ${page==='Settings'?'active':''}`} onClick={()=>navTo('Settings')}><Settings2 size={18}/><span>Settings</span></button>
        <div className="profile"><div className="avatar">S</div><div><b>Student workspace</b><small>Personal learning space</small></div><MoreHorizontal size={18}/></div>
      </div>
    </aside>
    {mobileOpen&&<div className="scrim" onClick={()=>setMobileOpen(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileOpen(true)}><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><div className={`api-pill ${apiStatus==='Connected'?'online':''}`} title="Backend service status"><i/>{apiStatus==='Connected'?'Backend online':apiStatus==='Checking'?'Checking backend':'Backend offline'}</div><div className={`api-pill ${aiStatus==='Configured'?'online':''}`} title="AI provider configuration status"><i/>{`AI ${aiStatus.toLowerCase()}`}</div><button className="icon-btn"><Search size={18}/></button><button className="icon-btn"><Command size={17}/></button><div className="avatar small">S</div></div></header>
      <div className="page-content">
        {notice&&<div className="notice"><CheckCircle2 size={17}/><span>{notice}</span><button onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {page==='Overview'&&<Overview topics={topics} sessions={todaySessions} completion={completion} mastery={mastery} hard={hardTopics.length} nextTopic={nextTopic} onUpload={upload} busy={fileBusy} onNavigate={navTo} onDone={markDone} onQuiz={generateQuiz} onRescue={runRescue} onFocus={()=>setFocus(true)}/>}
        {page==='Knowledge map'&&<KnowledgeMap topics={topics} filtered={filtered} query={query} setQuery={setQuery} onSelect={setSelectedTopic} onQuiz={generateQuiz} onDone={markDone} onUpload={upload} busy={fileBusy} onAdd={openAdd} onEdit={(t)=>{setDraft({title:t.title,subject:t.subject,unit:t.unit,difficulty:t.difficulty,estimated_hours:t.estimated_hours});setEditor(t)}} onDelete={(t)=>{setTopics(p=>p.filter(x=>x.id!==t.id));setSessions(p=>p.filter(x=>x.topic_id!==t.id));setNotice('Topic deleted.')}}/>}
        {page==='Study planner'&&<Planner sessions={sessions} examDate={examDate} setExamDate={setExamDate} hours={hours} setHours={setHours} onGenerate={generatePlan} onDone={(s)=>{const t=topics.find(t=>t.id===s.topic_id);if(t)markDone(t);setSessions(p=>p.filter(x=>x.id!==s.id))}} onRescue={runRescue}/>}
        {page==='Practice lab'&&<Practice topics={topics} selected={selectedTopic} questions={questions} busy={quizBusy} activeQuestion={activeQuestion} showAnswer={showAnswer} setShowAnswer={setShowAnswer} onGenerate={generateQuiz} onConfidence={(v)=>{setConfidence(v);if(selectedTopic)updateTopic(selectedTopic.id,{confidence:v*20})}} confidence={confidence}/>}
        {page==='Progress'&&<Progress topics={topics} mastery={mastery} completion={completion} done={done.length} onQuiz={generateQuiz}/> }
        {page==='Settings'&&<SettingsPage onReset={resetDemo} onAdd={openAdd} topics={topics.length} backend={apiStatus} ai={aiStatus}/>}
      </div>
      <footer className="footer"><span>MindMap AI <i>·</i> Think clearly. Learn deeply.</span><span>Built for students, not just schedules.</span></footer>
    </main>
    {editor!==false&&<div className="modal-backdrop" onClick={()=>setEditor(false)}><div className="topic-modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setEditor(false)}><X/></button><span className="eyebrow">TOPIC EDITOR</span><h2>{editor?'Edit topic':'Add a topic'}</h2><div className="editor-fields"><label>Topic name<input value={draft.title} onChange={e=>setDraft(p=>({...p,title:e.target.value}))} placeholder="e.g. Operating system scheduling"/></label><label>Subject<input value={draft.subject} onChange={e=>setDraft(p=>({...p,subject:e.target.value}))}/></label><label>Unit<input value={draft.unit} onChange={e=>setDraft(p=>({...p,unit:e.target.value}))}/></label><label>Difficulty<select value={draft.difficulty} onChange={e=>setDraft(p=>({...p,difficulty:e.target.value as Topic['difficulty']}))}><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label>Estimated hours<input type="number" min="0.25" max="20" step="0.25" value={draft.estimated_hours} onChange={e=>setDraft(p=>({...p,estimated_hours:Number(e.target.value)}))}/></label></div><div className="modal-actions"><button className="btn-secondary" onClick={()=>setEditor(false)}>Cancel</button><button className="btn-primary" onClick={saveTopic}>Save topic</button></div></div></div>}
    {selectedTopic&&page!=='Practice lab'&&<div className="modal-backdrop" onClick={()=>setSelectedTopic(null)}><div className="topic-modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setSelectedTopic(null)}><X/></button><span className="eyebrow">TOPIC INTELLIGENCE</span><h2>{selectedTopic.title}</h2><p>{selectedTopic.subject} · {selectedTopic.unit}</p><div className="modal-stats"><div><small>Confidence</small><b>{selectedTopic.confidence}%</b></div><div><small>Difficulty</small><b>{selectedTopic.difficulty}</b></div><div><small>Study estimate</small><b>{selectedTopic.estimated_hours}h</b></div></div><div className="confidence-track"><i style={{width:`${selectedTopic.confidence}%`}}/></div><p className="muted">This topic is part of your learning constellation. Prioritise it based on confidence, difficulty and your exam timeline.</p><div className="modal-actions"><button className="btn-secondary" onClick={()=>{setSelectedTopic(null);generateQuiz(selectedTopic)}}><Brain size={16}/> Practice this topic</button><button className="btn-primary" onClick={()=>{markDone(selectedTopic);setSelectedTopic(null)}}><Check size={16}/> Mark mastered</button></div></div></div>}
    {showRescue&&<div className="modal-backdrop" onClick={()=>setShowRescue(false)}><div className="rescue-modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setShowRescue(false)}><X/></button><span className="eyebrow">PLAN RESCUE ENGINE</span><h2>Your comeback plan.</h2><p className="muted">A missed session is not a failed plan. Here's a suggested redistribution of your unfinished topics.</p>{rescue.map(d=><div className="rescue-day" key={d.day}><b>Day {d.day}{d.buffer?' · Revision buffer':''}</b>{d.topics.length?d.topics.map(t=><span key={t}>{t}</span>):<span className="muted">Open space for review or rest</span>}</div>)}<button className="btn-primary full" onClick={()=>setShowRescue(false)}>Use this as my reset plan <ArrowRight size={16}/></button></div></div>}
    {focus&&<div className="focus-overlay"><button className="focus-close" onClick={()=>setFocus(false)}><X/></button><div className="focus-card"><span className="eyebrow">FOCUS MODE</span><h2>One thing at a time.</h2><p>Choose one topic. Give it your full attention.</p><div className="timer-ring"><span>25:00</span><small>FOCUS SESSION</small></div><button className="btn-primary" onClick={()=>setFocus(false)}>Finish focus session</button><small className="muted">Demo timer screen · connect a timer engine for live countdowns.</small></div></div>}
  </div>
}

function PageTitle({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action?:ReactNode}) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>{action}</div>
}
function Overview({topics,sessions,completion,mastery,hard,nextTopic,onUpload,busy,onNavigate,onDone,onQuiz,onRescue,onFocus}:{topics:Topic[];sessions:Session[];completion:number;mastery:number;hard:number;nextTopic?:Topic;onUpload:(f?:File)=>void;busy:boolean;onNavigate:(p:Page)=>void;onDone:(t:Topic)=>void;onQuiz:(t:Topic)=>void;onRescue:()=>void;onFocus:()=>void}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return <>
    <PageTitle eyebrow="MONDAY, YOUR LEARNING DAY" title="Good morning, learner." desc="Your syllabus has a shape. Let's turn it into momentum." action={<button className="btn-secondary" onClick={()=>fileRef.current?.click()}><UploadCloud size={16}/> Upload syllabus</button>}/>
    <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={e=>onUpload(e.target.files?.[0])}/>
    <section className="hero-panel"><div className="hero-copy"><div className="hero-chip"><Sparkles size={13}/> YOUR PERSONAL LEARNING INTELLIGENCE</div><h2>Small steps.<br/><em>Serious progress.</em></h2><p>Your next breakthrough is probably hidden inside one difficult topic. Let's find it.</p><div className="hero-actions"><button className="btn-white" onClick={()=>onNavigate(topics.length?'Study planner':'Knowledge map')}>{topics.length?"View today's plan":'Add your syllabus'} <ArrowRight size={16}/></button><button className="hero-link" onClick={onFocus}><Timer size={16}/> Start focus mode</button></div></div><div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><Brain size={38}/></div><div className="orbit-node node-a"><Target size={16}/></div><div className="orbit-node node-b"><Zap size={16}/></div><div className="orbit-node node-c"><CheckCircle2 size={16}/></div><div className="float-label">LEARNING IN MOTION</div></div><div className="hero-index">01 <span>/ YOUR STUDY SYSTEM</span></div></section>
    <section className="stats-grid">
      <Stat icon={<ListChecks/>} label="Syllabus coverage" value={`${completion}%`} note={`${topics.length-completedCount(topics)} topics to go`} trend="+12% this week" />
      <Stat icon={<Gauge/>} label="Average confidence" value={`${mastery}%`} note="Across all tracked topics" trend="Learning signal" />
      <Stat icon={<Brain/>} label="Needs attention" value={String(hard)} note="High-difficulty topics" trend="Priority queue" />
      <Stat icon={<Flame/>} label="Learning streak" value="06 days" note="You're showing up" trend="Keep it alive" />
    </section>
    <div className="content-grid">
      <section className="panel today-panel"><div className="panel-head"><div><div className="eyebrow">YOUR NEXT MOVES</div><h3>Today's focus</h3></div><button className="text-button" onClick={()=>onNavigate('Study planner')}>Full planner <ArrowRight size={15}/></button></div>
        {sessions.length?sessions.map((s,i)=><div className="session-row" key={s.id}><div className="time-block"><b>{i===0?'09:00':'11:00'}</b><small>{s.duration_hours}h</small></div><div className="session-line"><i/></div><div className="session-info"><div className="session-meta"><span className="tag-purple">{s.type}</span><span>{s.duration_hours} hour session</span></div><b>{s.topic}</b><small>{s.reason}</small></div><button className="round-check" title="Mark topic complete" onClick={()=>{const t=topics.find(t=>t.id===s.topic_id);if(t)onDone(t)}}><Check size={16}/></button></div>):<div className="empty-state">No sessions today. Generate a plan to get started.</div>}
      </section>
      <section className="panel next-panel"><div className="panel-head"><div><div className="eyebrow">THE SMART NEXT STEP</div><h3>Where to focus</h3></div><Sparkles className="spark-icon"/></div>{nextTopic?<><div className="priority-label"><span className="priority-dot"/> HIGH-IMPACT OPPORTUNITY</div><h2>{nextTopic.title}</h2><p>Low confidence meets {nextTopic.difficulty.toLowerCase()} difficulty. A focused session here can unlock progress in related concepts.</p><div className="priority-metrics"><div><small>Confidence</small><b>{nextTopic.confidence}%</b></div><div><small>Estimated time</small><b>{nextTopic.estimated_hours}h</b></div><div><small>Unit</small><b>{nextTopic.unit}</b></div></div><button className="btn-primary full" onClick={()=>onQuiz(nextTopic)}>Start a practice set <ArrowRight size={16}/></button></>:<p>You've completed your current topics. Upload another syllabus to continue.</p>}</section>
    </div>
    <section className="panel bottom-panel"><div className="panel-head"><div><div className="eyebrow">ADAPTIVE LEARNING</div><h3>Your study system, not a static timetable.</h3></div><span className="live-badge"><i/> ACTIVE</span></div><div className="feature-strip"><Feature icon={<Map/>} title="Knowledge constellation" text="See how topics connect and where foundations are missing." onClick={()=>onNavigate('Knowledge map')}/><Feature icon={<RefreshCw/>} title="Plan rescue" text="Rebuild your schedule when life gets in the way." onClick={onRescue}/><Feature icon={<Target/>} title="Confidence reality check" text="Compare what you think you know with what you can prove." onClick={()=>onNavigate('Progress')}/></div></section>
    {busy&&<div className="loading-cover"><RefreshCw className="spin"/> Reading your syllabus…</div>}
  </>
}

function SettingsPage({onReset,onAdd,topics,backend,ai}:{onReset:()=>void;onAdd:()=>void;topics:number;backend:string;ai:string}){
  return <><PageTitle eyebrow="WORKSPACE CONTROL" title="Make this space yours." desc="Manage your syllabus, demo data and service connections."/><div className="content-grid"><section className="panel"><div className="eyebrow">YOUR CONTENT</div><h3>Workspace data</h3><p className="muted">You currently have {topics} topics saved in this browser. Changes are stored locally and remain after refresh on this device.</p><div className="modal-actions"><button className="btn-primary" onClick={onAdd}><Plus size={16}/> Add a topic</button><button className="btn-secondary" onClick={onReset}>Clear demo workspace</button></div></section><section className="panel"><div className="eyebrow">CONNECTION DIAGNOSTICS</div><h3>What is actually connected?</h3><div className="insight"><span className="insight-icon green"><Activity/></span><div><b>Backend API: {backend}</b><p>This checks whether the MindMap API health endpoint responds. It does not mean an AI model is connected.</p></div></div><div className="insight"><span className="insight-icon purple"><Sparkles/></span><div><b>AI provider: {ai}</b><p>AI is configured only when a server-side provider key is present. Otherwise the app uses clearly labelled local practice templates.</p></div></div></section></div></>
}

function completedCount(topics:Topic[]){return topics.filter(t=>t.status==='completed').length}
function Stat({icon,label,value,note,trend}:{icon:ReactNode;label:string;value:string;note:string;trend:string}){return <div className="stat-card"><div className="stat-top"><span className="stat-icon">{icon}</span><span className="stat-trend">{trend}</span></div><div className="stat-value">{value}</div><div className="stat-label">{label}</div><small>{note}</small></div>}
function Feature({icon,title,text,onClick}:{icon:ReactNode;title:string;text:string;onClick:()=>void}){return <button className="feature-item" onClick={onClick}><span className="feature-icon">{icon}</span><b>{title}</b><small>{text}</small><ArrowUpRight size={15} className="feature-arrow"/></button>}
function KnowledgeMap({topics,filtered,query,setQuery,onSelect,onQuiz,onDone,onUpload,busy,onAdd,onEdit,onDelete}:{topics:Topic[];filtered:Topic[];query:string;setQuery:(s:string)=>void;onSelect:(t:Topic)=>void;onQuiz:(t:Topic)=>void;onDone:(t:Topic)=>void;onUpload:(f?:File)=>void;busy:boolean;onAdd:()=>void;onEdit:(t:Topic)=>void;onDelete:(t:Topic)=>void}){
  const groups=useMemo(()=>Array.from(new Set(topics.map(t=>t.unit))),[topics])
  return <><PageTitle eyebrow="YOUR LEARNING GRAPH" title="Knowledge constellation." desc="A living map of what you know, what connects, and what needs attention." action={<div className="title-actions"><button className="btn-secondary" onClick={onAdd}><Plus size={16}/> Add topic</button><label className="btn-primary upload-label"><UploadCloud size={16}/> Import syllabus<input type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={e=>onUpload(e.target.files?.[0])}/></label></div>}/>
    <div className="map-summary"><div><span className="map-legend mastered"/><b>Mastered</b><small>Confidence 75%+</small></div><div><span className="map-legend learning"/><b>Learning</b><small>In progress</small></div><div><span className="map-legend focus"/><b>Needs focus</b><small>Low confidence / hard</small></div><div className="map-total"><b>{topics.length}</b><small>TOPIC NODES</small></div></div>
    <section className="constellation-panel"><div className="constellation-lines"><svg viewBox="0 0 900 420" preserveAspectRatio="none"><path d="M120 190 Q250 40 360 150 T600 130 T800 200 M120 190 Q230 350 360 260 T600 290 T800 200 M360 150 L360 260 M600 130 L600 290" fill="none" stroke="rgba(156,139,255,.25)" strokeWidth="2" strokeDasharray="5 7"/></svg></div><div className="constellation-center"><Brain size={24}/><b>{topics[0]?.subject||'Your syllabus'}</b><small>LEARNING MAP</small></div>{topics.slice(0,8).map((t,i)=>{const positions=[['13%','34%'],['30%','18%'],['48%','35%'],['68%','20%'],['86%','42%'],['26%','72%'],['54%','72%'],['78%','76%']];return <button key={t.id} className={`topic-node ${t.status==='completed'?'mastered':t.difficulty==='Hard'?'needs-focus':'learning'}`} style={{left:positions[i][0],top:positions[i][1]}} onClick={()=>onSelect(t)}><span className="node-pulse"/><b>{t.title}</b><small>{t.confidence}% confidence</small></button>})}<div className="map-caption">Select any node to inspect its learning signals</div></section>
    <section className="panel topic-list-panel"><div className="panel-head"><div><div className="eyebrow">TOPIC DIRECTORY</div><h3>Every concept, accounted for.</h3></div><div className="search-field"><Search size={15}/><input placeholder="Find a topic…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="topic-table">{filtered.map(t=><div className="topic-table-row" key={t.id}><div className={`topic-status ${t.status}`}/><div className="topic-table-title"><b>{t.title}</b><small>{t.unit} · {t.subject}</small></div><span className={`difficulty ${t.difficulty.toLowerCase()}`}>{t.difficulty}</span><div className="mini-progress"><i style={{width:`${t.confidence}%`}}/></div><b className="confidence-number">{t.confidence}%</b><button className="small-icon" onClick={()=>onQuiz(t)}><Brain size={16}/></button><button className="small-icon" title="Mark complete" onClick={()=>onDone(t)}><Check size={16}/></button><button className="small-icon" title="Edit topic" onClick={()=>onEdit(t)}><Settings2 size={15}/></button><button className="small-icon" title="Delete topic" onClick={()=>onDelete(t)}><X size={15}/></button></div>)}</div>{!filtered.length&&<div className="empty-state">{topics.length?'No topics match that search.':'No syllabus topics yet. Upload a syllabus or add your first topic.'}</div>}</section>
    {busy&&<div className="loading-cover"><RefreshCw className="spin"/> Extracting topics…</div>}
  </>
}
function Planner({sessions,examDate,setExamDate,hours,setHours,onGenerate,onDone,onRescue}:{sessions:Session[];examDate:string;setExamDate:(s:string)=>void;hours:number;setHours:(n:number)=>void;onGenerate:()=>void;onDone:(s:Session)=>void;onRescue:()=>void}){
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return d})
  return <><PageTitle eyebrow="ADAPTIVE SCHEDULING" title="Make time work for you." desc="A flexible plan that respects your energy, your deadlines and your actual progress." action={<button className="btn-secondary" onClick={onRescue}><RefreshCw size={16}/> Rescue my plan</button>}/>
    <section className="planner-config panel"><div><div className="eyebrow">PLAN PARAMETERS</div><h3>Build around your real life.</h3><p>Set your exam date and daily capacity. The planner prioritises difficult topics and protects revision time.</p></div><div className="planner-fields"><label>Exam date<input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)}/></label><label>Daily study time<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>1 hour</option><option value={1.5}>1.5 hours</option><option value={2}>2 hours</option><option value={3}>3 hours</option><option value={4}>4 hours</option><option value={5}>5 hours</option></select></label><button className="btn-primary" onClick={onGenerate}><WandSparkles size={16}/> Generate my plan</button></div></section>
    <div className="planner-week"><div className="panel-head"><div><div className="eyebrow">YOUR NEXT SEVEN DAYS</div><h3>Study rhythm</h3></div><span className="live-badge"><i/> LIVE PLAN</span></div><div className="week-grid">{days.map((d,i)=><div className={`week-day ${i===0?'today':''}`} key={i}><small>{d.toLocaleDateString('en',{weekday:'short'}).toUpperCase()}</small><b>{d.getDate()}</b><span>{sessions.filter(s=>s.date===d.toISOString().slice(0,10)).length} sessions</span></div>)}</div></div>
    <section className="panel schedule-panel"><div className="panel-head"><div><div className="eyebrow">SESSION QUEUE</div><h3>Upcoming study blocks</h3></div><span className="session-count">{sessions.length} sessions</span></div>{sessions.sort((a,b)=>a.date.localeCompare(b.date)).map(s=><div className="schedule-row" key={s.id}><div className="schedule-date"><b>{new Date(`${s.date}T00:00:00`).toLocaleDateString('en',{day:'2-digit'})}</b><small>{new Date(`${s.date}T00:00:00`).toLocaleDateString('en',{month:'short'})}</small></div><div className="schedule-detail"><span className="tag-purple">{s.type}</span><b>{s.topic}</b><small>{s.reason}</small></div><div className="schedule-duration"><Clock3 size={15}/>{s.duration_hours}h</div><button className="btn-tiny" onClick={()=>onDone(s)}><Check size={14}/> Complete</button></div>)}</section>
  </>
}
function Practice({topics,selected,questions,busy,activeQuestion,showAnswer,setShowAnswer,onGenerate,onConfidence,confidence}:{topics:Topic[];selected:Topic|null;questions:Question[];busy:boolean;activeQuestion:string;showAnswer:number[];setShowAnswer:(n:number[])=>void;onGenerate:(t:Topic)=>void;onConfidence:(n:number)=>void;confidence:number}){
  const [chosen,setChosen]=useState(selected?.id||topics[0]?.id||'')
  const current=topics.find(t=>t.id===chosen)||topics[0]
  return <><PageTitle eyebrow="ACTIVE RECALL STUDIO" title="Prove what you know." desc="Recognition feels like learning. Retrieval proves it. Build a practice set and test your understanding."/>
    <div className="practice-layout"><section className="panel practice-builder"><div className="eyebrow">BUILD A PRACTICE SET</div><h3>Choose your challenge.</h3><p>Generate prompts from a topic in your syllabus. With a Gemini key configured, the backend can generate richer source-grounded questions.</p><label className="field-label">TOPIC<select value={chosen} onChange={e=>setChosen(e.target.value)}>{topics.map(t=><option value={t.id} key={t.id}>{t.title}</option>)}</select></label><div className="practice-topic-preview"><div className="feature-icon"><Brain/></div><div><b>{current?.title||'No topics yet'}</b><small>{current?.unit} · {current?.difficulty} difficulty</small></div></div><button className="btn-primary full" disabled={!current||busy} onClick={()=>current&&onGenerate(current)}>{busy?<RefreshCw className="spin"/>:<Sparkles size={16}/>} Generate practice questions</button><div className="practice-note"><CircleHelp size={16}/> Questions are practice prompts, not official exam predictions.</div></section>
    <section className="panel question-panel"><div className="panel-head"><div><div className="eyebrow">YOUR PRACTICE DECK</div><h3>{selected?.title||'Ready when you are'}</h3></div><span className="tag-purple">{questions.length} QUESTIONS</span></div>{questions.length? <><div className="mode-note"><Sparkles size={14}/>{activeQuestion}</div>{questions.map((q,i)=><div className="question-card" key={i}><div className="question-head"><span>QUESTION {String(i+1).padStart(2,'0')}</span><span>{q.type}</span></div><b>{q.question}</b><button className="answer-toggle" onClick={()=>setShowAnswer(showAnswer.includes(i)?showAnswer.filter(x=>x!==i):[...showAnswer,i])}>{showAnswer.includes(i)?'Hide answer':'Reveal suggested answer'} <ChevronDown size={15}/></button>{showAnswer.includes(i)&&<div className="answer-box"><b>Suggested answer direction</b><p>{q.answer}</p><small>{q.explanation}</small></div>}</div>)}</>:<div className="practice-empty"><div className="empty-brain"><Brain size={30}/></div><h3>Your next insight starts with a question.</h3><p>Choose a topic and generate a set. Try explaining each answer without looking at your notes.</p></div>}</section></div>
    <section className="panel confidence-panel"><div><div className="eyebrow">CONFIDENCE REALITY CHECK</div><h3>How well do you think you know this?</h3><p>Rate your confidence after practice. Compare it with your actual quiz performance over time.</p></div><div className="confidence-control"><div className="confidence-label"><span>Not yet</span><b>{confidence*20}%</b><span>Could teach it</span></div><input type="range" min="1" max="5" value={confidence} onChange={e=>onConfidence(Number(e.target.value))}/><button className="btn-secondary" onClick={()=>onConfidence(confidence)}>Save confidence</button></div></section>
  </>
}
function Progress({topics,mastery,completion,done,onQuiz}:{topics:Topic[];mastery:number;completion:number;done:number;onQuiz:(t:Topic)=>void}){
  const sorted=[...topics].sort((a,b)=>a.confidence-b.confidence)
  return <><PageTitle eyebrow="EVIDENCE OF LEARNING" title="Progress you can trust." desc="Look beyond streaks. Track topic mastery, confidence and the work still ahead."/>
    <section className="progress-hero panel"><div><div className="eyebrow">OVERALL MASTERY SIGNAL</div><div className="big-mastery">{mastery}<small>/100</small></div><p>Average self-reported confidence across your syllabus. Use practice results to calibrate this number.</p></div><div className="progress-ring" style={{'--progress':`${completion*3.6}deg`} as CSSProperties}><div><b>{completion}%</b><small>COMPLETE</small></div></div><div className="progress-facts"><div><b>{done}</b><small>Completed topics</small></div><div><b>{topics.length-done}</b><small>Still to explore</small></div></div></section>
    <div className="content-grid"><section className="panel"><div className="eyebrow">TOPIC MASTERY</div><h3>Where you stand.</h3>{sorted.map(t=><div className="mastery-row" key={t.id}><div><b>{t.title}</b><small>{t.unit}</small></div><div className="mastery-bar"><i style={{width:`${t.confidence}%`}}/></div><b>{t.confidence}%</b><button className="small-icon" onClick={()=>onQuiz(t)}><Brain size={15}/></button></div>)}</section><section className="panel insight-panel"><div className="eyebrow">LEARNING INSIGHTS</div><h3>Your next level.</h3><div className="insight"><span className="insight-icon orange"><ArrowDownRight/></span><div><b>Confidence gaps</b><p>{sorted.filter(t=>t.confidence<50).length} topics have confidence below 50%. Prioritise retrieval practice.</p></div></div><div className="insight"><span className="insight-icon purple"><Target/></span><div><b>Mastery target</b><p>Aim for 80%+ confidence and successful practice before marking a topic mastered.</p></div></div><div className="insight"><span className="insight-icon green"><CheckCircle2/></span><div><b>Keep the loop going</b><p>Study, test, rate confidence, then revisit topics that still feel uncertain.</p></div></div></section></div>
  </>
}
export default App
