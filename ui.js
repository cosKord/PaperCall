const root = document.querySelector('#app');
let state = null;
let message = '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const post = async (url, data = {}) => {
  const response = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const body = await response.json();
  if(!response.ok) throw new Error(body.error || 'Something went wrong');
  return body;
};
function loginView(){
  root.innerHTML = `<div class="loginwrap"><section class="loginhero"><div class="brand"><span class="mark">✓</span> Exam Prediction Lab</div><div><h1>Make the call before the paper drops.</h1><p>Predict which topics and questions appear. Put virtual points behind your conviction, then see how the class did after results are in.</p></div><p>Demo game · virtual points only</p></section><section class="loginbox"><h2>Welcome back</h2><p class="muted">Sign in to play or manage exams.</p>${message ? `<div class="notice" role="alert">${esc(message)}</div>` : ''}<form data-action="login"><label>Username<input name="username" autocomplete="username" required autofocus></label><label>Password<input type="password" name="password" autocomplete="current-password" required></label><button>Sign in</button></form><div class="hint"><strong>Demo accounts</strong><br>Admin: <code>admin / admin123</code><br>Players: <code>alice / player123</code> or <code>bob / player123</code></div></section></div>`;
}
function marketView(m, exam){
  const player = state.user.role === 'player';
  const bets = m.my_bets.length ? `<p class="mybets">Your bets: ${m.my_bets.map(b => `${esc(b.side)} ${b.stake} pt${m.result ? ` → <strong class="${b.net < 0 ? 'negative' : 'positive'}">${b.net > 0 ? '+' : ''}${b.net} pt net</strong>` : ' · awaiting result'}`).join(' · ')}</p>` : '';
  const pool = m.pool ? `<p class="pool">Revealed pool: YES ${m.pool.YES} · NO ${m.pool.NO} pt</p>` : '';
  const result = m.result ? `<span class="result">${esc(m.result)}${m.settlement === 'refund' ? ' · all stakes refunded' : ''}</span>` : '';
  const bet = player && !exam.closed && !m.result ? `<form class="betform" data-action="bet"><input type="hidden" name="market_id" value="${m.id}"><label>Your call<select name="side"><option>YES</option><option>NO</option></select></label><label>Stake<input name="stake" type="number" min="1" max="${state.user.balance}" step="1" value="25" required></label><button>Place bet</button></form>` : '';
  const settle = !player && !m.result && new Date(exam.starts_at) <= new Date() ? `<form class="settle" data-action="settle"><input type="hidden" name="market_id" value="${m.id}"><span class="muted">Set result</span><select name="result"><option>YES</option><option>NO</option></select><button>Settle market</button></form>` : '';
  return `<div class="market"><div class="marketline"><div><div class="kind">${m.kind === 'topic' ? 'Topic prediction' : 'Specific question'}</div><div class="prompt">${esc(m.prompt)}</div></div>${result}</div>${bet}${bets}${pool}${settle}</div>`;
}
function examView(e){
  const admin = state.user.role === 'admin';
  const add = admin && !e.closed ? `<form class="addmarket" data-action="market"><input type="hidden" name="exam_id" value="${e.id}"><select name="kind"><option value="topic">Topic</option><option value="question">Specific question</option></select><input name="prompt" placeholder="What will appear?" maxlength="240" required><button>Add market</button></form>` : '';
  const lock = admin && !e.closed ? `<div class="examactions"><button class="ghost" data-action="lock" data-id="${e.id}">Lock betting now</button></div>` : '';
  return `<article class="exam"><div class="examhead"><div><h3>${esc(e.title)}</h3><div class="date">Exam starts ${date(e.starts_at)}</div>${lock}</div><span class="badge ${e.closed ? 'closed' : ''}">${e.closed ? 'Betting closed' : 'Open for bets'}</span></div>${e.markets.length ? e.markets.map(m => marketView(m,e)).join('') : '<div class="market muted">No predictions added yet.</div>'}${add}</article>`;
}
function appView(){
  const admin = state.user.role === 'admin';
  const form = admin ? `<section class="formbox"><h2>Create an exam</h2><p>Add a start time, then create topic or specific question markets.</p><form class="gridform" data-action="exam"><label>Exam title<input name="title" maxlength="120" placeholder="e.g. Data Structures midterm" required></label><label>Starts at<input name="starts_at" type="datetime-local" required></label><button>Create exam</button></form></section>` : '';
  root.innerHTML = `<div class="shell"><header class="top"><div class="brand"><span class="mark">✓</span> Exam Prediction Lab</div><div class="account"><span>${admin ? 'Admin' : 'Player'} · ${esc(state.user.username)}</span><button class="ghost" data-action="logout">Sign out</button></div></header><section class="intro"><div><h1>${admin ? 'Run the prediction room.' : 'Call your shots.'}</h1><p>${admin ? 'Create exams, publish predictions, close betting, and settle each result.' : 'Choose YES or NO before the exam begins. Other bets and the pool stay hidden until a market is settled.'}</p></div>${admin ? '' : `<div class="balance"><span>Available points</span><strong>${state.user.balance.toLocaleString()}</strong></div>`}</section>${message ? `<div class="notice" role="alert">${esc(message)}</div>` : ''}${form}<div class="layout"><main><div class="sectionhead"><h2>Exams</h2><span class="muted">${state.exams.length} total</span></div>${state.exams.length ? state.exams.map(examView).join('') : '<div class="empty">No exams yet. The admin can create one to get the game started.</div>'}</main><aside class="sidepanel"><h2>Net score</h2><p>Settled gains and losses only. Live stakes and balances stay private.</p>${state.leaderboard.map((r,i) => `<div class="rank"><span>${i+1}. ${esc(r.username)}</span><span class="${r.profit < 0 ? 'negative' : 'positive'}">${r.profit > 0 ? '+' : ''}${r.profit} pt</span></div>`).join('')}<p class="foot">Payouts share the entire pool among winning stakes. If nobody backed the winning side, everyone gets their stake back. No real money.</p></aside></div></div>`;
}
function render(){state ? appView() : loginView()}
async function refresh(){try{const response=await fetch('/api/state');state=response.ok ? await response.json() : null}catch{state=null}render()}
document.addEventListener('submit',async event=>{
  const form=event.target.closest('form[data-action]');if(!form)return;event.preventDefault();
  const action=form.dataset.action;const fields=Object.fromEntries(new FormData(form));
  try{
    const paths={login:'/api/login',exam:'/api/exams',market:'/api/markets',bet:'/api/bets',settle:'/api/settle'};
    if(action==='exam')fields.starts_at=new Date(fields.starts_at).toISOString();
    for(const key of ['exam_id','market_id','stake'])if(key in fields)fields[key]=Number(fields[key]);
    state=await post(paths[action],fields);message='';render();
  }catch(error){message=error.message;render()}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button[data-action]');if(!button)return;
  try{if(button.dataset.action==='logout'){await post('/api/logout');state=null}else if(button.dataset.action==='lock'){state=await post('/api/lock',{exam_id:Number(button.dataset.id)})}message='';render()}catch(error){message=error.message;render()}
});
refresh();
