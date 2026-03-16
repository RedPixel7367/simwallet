let key = ""
let tokens = []
let transactions = []
let previousTotal = 0
let licenseData = {}
let autoNotifTimer = null
let notifMode = { type: "auto", amount: "fixed" }
let currentPrices = {}
let displayedBalance = 0
let sheetJustOpened = false
let selectedSendIndex = -1
let selectedReceiveIndex = -1
let walletAddress = ""
let autoRefreshCount = 0
let currentDetailIndex = -1
let currentTf = "1D"
let cashShowState = false

const tokenImages = {
  SOL:"https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
  BTC:"https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH:"https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/ethereum/info/logo.png",
  USDT:"https://assets.coingecko.com/coins/images/325/large/Tether.png",
  USDC:"https://static.phantom.app/assets/usdc.png",
  BNB:"https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  PEPE:"https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg",
  DOGE:"https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  SHIB:"https://assets.coingecko.com/coins/images/11939/large/shiba.png",
  WIF:"https://assets.coingecko.com/coins/images/33566/large/wif.png",
  BONK:"https://assets.coingecko.com/coins/images/28600/large/bonk.jpg",
  FLOKI:"https://assets.coingecko.com/coins/images/16746/large/PNG_image.png",
  MON:"https://dhc7eusqrdwa0.cloudfront.net/assets/monad.png",
  SUI:"https://dhc7eusqrdwa0.cloudfront.net/assets/sui.png",
  POL:"https://wallet-asset.matic.network/img/tokens/matic.svg",
  HYPE:"https://app.hyperliquid.xyz/coins/HYPE_spot.svg",
}

const tokenFullNames = {
  SOL:"Solana",BTC:"Bitcoin",ETH:"Ethereum",USDT:"Tether",
  USDC:"USD Coin",BNB:"BNB",PEPE:"Pepe",DOGE:"Dogecoin",
  SHIB:"Shiba Inu",WIF:"dogwifhat",BONK:"Bonk",FLOKI:"Floki",
  MON:"Monad",SUI:"Sui",POL:"Polygon",HYPE:"Hyperliquid",
}

const tokenBg = {
  SOL:"#9945ff",BTC:"#f7931a",ETH:"#627eea",USDT:"#26a17b",
  USDC:"#2775ca",BNB:"#f3ba2f",PEPE:"#3d9e3d",DOGE:"#c2a633",
  SHIB:"#e5720c",WIF:"#9945ff",BONK:"#f7931a",FLOKI:"#f0a500",
  MON:"#8b5cf6",SUI:"#4da2ff",POL:"#8247e5",HYPE:"#ff6b35",
}

const notifCoins = ["SOL","ETH","BTC","MON","SUI","POL","HYPE","USDT","USDC"]
const memecoins = [
  {symbol:"PEPE",amount:1000000},{symbol:"DOGE",amount:50000},
  {symbol:"SHIB",amount:5000000},{symbol:"WIF",amount:10000},
  {symbol:"BONK",amount:2000000},{symbol:"FLOKI",amount:300000},
]

function generateAddress() {
  const chars="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
  let addr=""
  for(let i=0;i<44;i++) addr+=chars[Math.floor(Math.random()*chars.length)]
  return addr
}

function shortAddr(addr){return addr.slice(0,6)+"..."+addr.slice(-6)}

function animateBalance(target) {
  const el=document.getElementById("value")
  if(!el) return
  const start=displayedBalance
  const startTime=performance.now()
  function step(now) {
    const progress=Math.min((now-startTime)/800,1)
    const ease=1-Math.pow(1-progress,3)
    const current=start+(target-start)*ease
    el.innerText="$"+current.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
    if(progress<1) requestAnimationFrame(step)
    else displayedBalance=target
  }
  requestAnimationFrame(step)
}

function toggleCashShow() {
  cashShowState=!cashShowState
  const track=document.getElementById("cash-toggle-track")
  const label=document.getElementById("cash-show-label")
  if(cashShowState){track.classList.add("on");label.innerText="Visible"}
  else{track.classList.remove("on");label.innerText="Hidden"}
}

function drawQR(canvasId, text) {
  const qrBox = document.querySelector(".qr-box")
  if (!qrBox) return
  qrBox.innerHTML = ""
  new QRCode(qrBox, {
    text: text,
    width: 200,
    height: 200,
    colorDark: "#000",
    colorLight: "#fff",
    correctLevel: QRCode.CorrectLevel.H
  })
}

async function fetchRealChartData(symbol,tf) {
  try {
    const intervalMap={"1H":"1m","1D":"5m","1W":"1h","1M":"4h","YTD":"1d","ALL":"1w"}
    const limitMap={"1H":60,"1D":288,"1W":168,"1M":180,"YTD":365,"ALL":200}
    const res=await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${intervalMap[tf]||"5m"}&limit=${limitMap[tf]||288}`)
    const data=await res.json()
    if(!Array.isArray(data)||data.length<2) return null
    return data.map(k=>parseFloat(k[4]))
  } catch(e){return null}
}

let chartPrices=[]
let chartPositive=true

function drawChart(prices, positive) {
  const canvas = document.getElementById("priceChart")
  if (!canvas) return
  chartPrices = prices
  chartPositive = positive
  const ctx = canvas.getContext("2d")
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  if (!prices || prices.length < 2) return
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1
  const pts = prices.map((p, i) => ({
    x: (i / (prices.length - 1)) * w,
    y: h - ((p - min) / range) * (h - 20) - 10
  }))
  const color = positive ? "#30a46c" : "#e5484d"

  // Full line in color
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) {
    const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 }
    ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, cp.x, cp.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Gradient fill
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, positive ? "rgba(48,164,108,0.3)" : "rgba(229,72,77,0.3)")
  grad.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = grad
  ctx.fill()

  // Dot at end
  const last = pts[pts.length - 1]
  ctx.beginPath()
  ctx.arc(last.x, last.y, 5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  setupChartHover(canvas, prices, pts, color)
}

function setupChartHover(canvas, prices, pts, color) {
  const wrap = document.getElementById("chartWrap")
  const hoverEl = document.getElementById("chartHoverPrice")
  const cursor = document.getElementById("chartCursor")
  if (!wrap || !hoverEl || !cursor) return

  function handleMove(clientX) {
    const rect=wrap.getBoundingClientRect()
    const x=Math.max(0,Math.min(clientX-rect.left,rect.width))
    const canvasX=(x/rect.width)*canvas.width
    const idx=Math.round((x/rect.width)*(prices.length-1))
    const clamped=Math.max(0,Math.min(prices.length-1,idx))
    const price=prices[clamped]

    // Update price display
    const priceEl=document.getElementById("detail-price")
    if(priceEl) priceEl.innerText="$"+price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:6})

    // Time label
    const tfMs={"1H":60*60*1000,"1D":24*60*60*1000,"1W":7*24*60*60*1000,"1M":30*24*60*60*1000,"YTD":365*24*60*60*1000,"ALL":4*365*24*60*60*1000}
    const totalMs=tfMs[currentTf]||24*60*60*1000
    const msPerPoint=totalMs/prices.length
    const pointTime=new Date(Date.now()-totalMs+clamped*msPerPoint)
    let timeStr
    if(currentTf==="1H"||currentTf==="1D") timeStr=pointTime.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})
    else if(currentTf==="1W") timeStr=pointTime.toLocaleDateString("en-US",{month:"short",day:"numeric"})
    else timeStr=pointTime.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
    hoverEl.style.display="block"
    hoverEl.style.left=x+"px"
    hoverEl.style.top="6px"
    hoverEl.style.transform="translateX(-50%)"
    hoverEl.innerText=timeStr

    drawChartAt(canvas,prices,chartPositive,canvasX)
  }
  wrap.onmousemove = (e) => handleMove(e.clientX)
  wrap.onmouseleave = handleEnd
  wrap.addEventListener("touchstart", (e) => { e.preventDefault(); handleMove(e.touches[0].clientX) }, {passive: false})
  wrap.addEventListener("touchmove", (e) => { e.preventDefault(); handleMove(e.touches[0].clientX) }, {passive: false})
  wrap.addEventListener("touchend", handleEnd, {passive: false})
}

function setupChartHover(canvas, prices, pts, color) {
  const wrap = document.getElementById("chartWrap")
  const hoverEl = document.getElementById("chartHoverPrice")
  const cursor = document.getElementById("chartCursor")
  if (!wrap || !hoverEl || !cursor) return

  function handleMove(clientX) {
    const rect = wrap.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const idx = Math.round((x / rect.width) * (prices.length - 1))
    const clamped = Math.max(0, Math.min(prices.length - 1, idx))
    const price = prices[clamped]

    const ctx = canvas.getContext("2d")
    const w = canvas.width, h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Grey part after cursor
    ctx.beginPath()
    ctx.moveTo(pts[clamped].x, pts[clamped].y)
    for (let i = clamped + 1; i < pts.length; i++) {
      const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 }
      ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, cp.x, cp.y)
    }
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Color part up to cursor
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i <= clamped; i++) {
      const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 }
      ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, cp.x, cp.y)
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Gradient fill
    ctx.lineTo(pts[clamped].x, h); ctx.lineTo(0, h); ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color === "#30a46c" ? "rgba(48,164,108,0.3)" : "rgba(229,72,77,0.3)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grad
    ctx.fill()

    // Horizontal dashed line
    ctx.beginPath()
    ctx.setLineDash([4, 4])
    ctx.moveTo(0, pts[clamped].y)
    ctx.lineTo(w, pts[clamped].y)
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.setLineDash([])

    // Moving dot
    ctx.beginPath()
    ctx.arc(pts[clamped].x, pts[clamped].y, 6, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.arc(pts[clamped].x, pts[clamped].y, 3, 0, Math.PI * 2)
    ctx.fillStyle = "#fff"
    ctx.fill()

    // Cursor line
    const cursorX = pts[clamped].x * (rect.width / w)
    cursor.style.display = "block"
    cursor.style.left = cursorX + "px"

    // Time label
    const totalMs = 24 * 60 * 60 * 1000
    const msPerPoint = totalMs / prices.length
    const pointTime = new Date(Date.now() - totalMs + clamped * msPerPoint)
    const timeStr = pointTime.toLocaleTimeString("en-US", {hour:"2-digit", minute:"2-digit"})
    hoverEl.style.display = "block"
    hoverEl.style.left = cursorX + "px"
    hoverEl.style.top = "6px"
    hoverEl.style.transform = "translateX(-50%)"
    hoverEl.innerText = timeStr

    // Update price display
    const priceEl = document.getElementById("detail-price")
    if (priceEl) priceEl.innerText = "$" + price.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 6})
  }

  function handleEnd() {
    hoverEl.style.display = "none"
    cursor.style.display = "none"
    if (chartPrices.length) drawChart(chartPrices, chartPositive)
  }

  wrap.onmousemove = (e) => handleMove(e.clientX)
  wrap.onmouseleave = handleEnd
  wrap.addEventListener("touchstart", (e) => { e.preventDefault(); handleMove(e.touches[0].clientX) }, {passive: false})
  wrap.addEventListener("touchmove", (e) => { e.preventDefault(); handleMove(e.touches[0].clientX) }, {passive: false})
  wrap.addEventListener("touchend", handleEnd, {passive: false})
}

async function loadChart(symbol,positive) {
  const canvas=document.getElementById("priceChart")
  if(!canvas) return
  const wrap=document.getElementById("chartWrap")
  if(wrap) {
    canvas.width=wrap.clientWidth
    canvas.height=200
  }
  const ctx=canvas.getContext("2d")
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle="#1a1a1a";ctx.fillRect(0,0,canvas.width,canvas.height)
  const prices=await fetchRealChartData(symbol,currentTf)
  if(prices){drawChart(prices,positive)}
  else{
    const p=currentPrices[symbol]
    const basePrice=p?p.usd:100,change=p?p.change:0
    let price=basePrice*(1-change/100)
    const fake=[]
    for(let i=0;i<60;i++){price+=(Math.random()-0.48)*basePrice*0.005;fake.push(price)}
    fake.push(basePrice)
    drawChart(fake,positive)
  }
}

async function login() {
  key=document.getElementById("key").value
  if(!key) return
  try {
    const res=await fetch("http://localhost:3000/login",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({key})
    })
    const data=await res.json()
    if(data.success){
      localStorage.setItem("key",key)
      localStorage.setItem("tokens",JSON.stringify(data.user.tokens))
      localStorage.setItem("transactions",JSON.stringify(data.user.transactions||[]))
      localStorage.setItem("username",data.user.username||"My Wallet")
      localStorage.setItem("license",JSON.stringify({
        plan:data.plan,days:data.days,
        createdAt:data.createdAt,expiryDate:data.expiryDate
      }))
      window.location="dashboard.html"
    } else {
      document.getElementById("err").innerText=data.message||"Invalid key."
    }
  } catch(e){document.getElementById("err").innerText="Cannot connect to server."}
}

function load() {
  key=localStorage.getItem("key")
  if(!key) return window.location="login.html"
  tokens=JSON.parse(localStorage.getItem("tokens"))||[]
  transactions=JSON.parse(localStorage.getItem("transactions"))||[]
  licenseData=JSON.parse(localStorage.getItem("license")||"{}")
  walletAddress="FPjXjmCbVYF2sxaWFoTcx9krGNLK9s4Rdoo3ThETGGLt"
  localStorage.setItem("walletAddress",walletAddress)
  autoRefreshCount=parseInt(localStorage.getItem("autoRefreshCount")||"0")

  const username=localStorage.getItem("username")||"My Wallet"
  const handle=localStorage.getItem("handle")||username.toLowerCase().replace(/\s/g,"")
  const emoji=localStorage.getItem("emoji")||"😭"
  const customBalance=parseFloat(localStorage.getItem("customBalance")||"0")
  const cashBalance=parseFloat(localStorage.getItem("cashBalance")||"0")

  updateHeaderDisplay(username,handle,emoji)

  const cashEl=document.getElementById("cash-display")
  if(cashEl) cashEl.innerText="$"+cashBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})

  if(customBalance>0){
    displayedBalance=customBalance
    const el=document.getElementById("value")
    if(el) el.innerText="$"+customBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
  }

  showSkeletons()
  renderMemecoins()
  renderCoinRows()
  updatePrices()
  setInterval(updatePrices,15000)
  setInterval(updatePeopleCounters,8000)

  document.getElementById("overlay").addEventListener("click",()=>{
    if(!sheetJustOpened) closeAll()
  })
document.getElementById("overlay").addEventListener("click",()=>{
    if(!sheetJustOpened) closeAll()
  })

  let startY = 0
  const spinner = document.getElementById("ptr-spinner")

  window.addEventListener("touchstart", e => { startY = e.touches[0].clientY }, { passive: true })
  window.addEventListener("touchend", e => {
    const endY = e.changedTouches[0].clientY
    if (endY - startY > 80) {
      if (spinner) spinner.style.display = "block"
      updatePrices()
      setTimeout(() => { if (spinner) spinner.style.display = "none" }, 1500)
    }
  }, { passive: true })
}

function updateHeaderDisplay(name,handle,emoji) {
  const nameEl=document.getElementById("username-display")
  const handleEl=document.getElementById("username-small")
  const starBtn=document.querySelector(".star-btn")
  if(nameEl) nameEl.innerHTML=name+`<svg fill="none" viewBox="0 0 24 24" width="14px" height="14px"><path stroke="currentColor" stroke-width="2" d="M19 9h-7a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3Z"></path><path stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M15 5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3"></path></svg>`
  if(handleEl) handleEl.innerText="@"+handle
  if(starBtn) starBtn.innerText=emoji
}

function updatePeopleCounters() {
  const el=document.getElementById("detail-people")
  if(el) el.innerText="● "+Math.floor(Math.random()*200+50)+" people here"
}

function showSkeletons() {
  const container=document.getElementById("tokens")
  if(!container) return
  container.innerHTML=""
  for(let i=0;i<4;i++){
    container.innerHTML+=`
      <div class="skeleton-row">
        <div class="sk-circle"></div>
        <div class="sk-lines">
          <div style="display:flex;justify-content:space-between;">
            <div class="sk-line" style="width:40%"></div>
            <div class="sk-line" style="width:30%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <div class="sk-line" style="width:55%"></div>
            <div class="sk-line" style="width:20%"></div>
          </div>
        </div>
      </div>`
  }
}

function renderTokens() {
  const container=document.getElementById("tokens")
  if(!container) return
  container.innerHTML=""
  tokens.forEach((t,i)=>{
    const img=tokenImages[t.symbol]||t.logoUrl||""
    const bg=tokenBg[t.symbol]||"#6c4cff"
    const fullName=tokenFullNames[t.symbol]||t.symbol
    const p=currentPrices[t.symbol]
    const usdVal=p?t.amount*p.usd:0
    const change=p?parseFloat(p.change.toFixed(2)):0
    const logoHTML=img?`<img src="${img}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;display:block;" onerror="this.style.display='none'">`:`<span style="font-size:16px;font-weight:700;">${t.symbol[0]}</span>`
    const btn=document.createElement("button")
    btn.className="token-row"
    btn.onclick=()=>openDetail(i)
    btn.innerHTML=`
      <div class="tok-logo" style="background:${bg}">${logoHTML}</div>
      <div class="tok-info">
        <div class="tok-top">
          <div class="tok-name-row">
            <span class="tok-name">${fullName}</span>
            <svg fill="none" viewBox="0 0 24 24" width="13px" height="13px"><path fill="#AB9FF2" fill-rule="evenodd" d="M12.737 1.271a1.136 1.136 0 0 0-1.473 0l-2.46 2.097a1.136 1.136 0 0 1-.647.268l-3.222.257a1.136 1.136 0 0 0-1.042 1.041l-.257 3.223a1.136 1.136 0 0 1-.268.646l-2.097 2.46a1.136 1.136 0 0 0 0 1.474l2.097 2.46c.155.182.249.408.268.646l.257 3.223c.044.556.486.997 1.042 1.041l3.222.257c.238.02.464.113.646.268l2.46 2.097a1.136 1.136 0 0 0 1.474 0l2.46-2.097c.182-.155.408-.249.646-.268l3.223-.257a1.136 1.136 0 0 0 1.041-1.041l.258-3.223c.019-.238.112-.464.267-.646l2.097-2.46a1.136 1.136 0 0 0 0-1.474l-2.097-2.46a1.136 1.136 0 0 1-.267-.646l-.258-3.223a1.136 1.136 0 0 0-1.041-1.041l-3.223-.257a1.136 1.136 0 0 1-.646-.268zm4.077 8.31a1 1 0 1 0-1.628-1.162l-4.314 6.04-2.165-2.166a1 1 0 0 0-1.414 1.414l3 3a1 1 0 0 0 1.52-.126z" clip-rule="evenodd"></path></svg>
          </div>
          <span class="tok-usd">${p?"$"+usdVal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):"$0.00"}</span>
        </div>
        <div class="tok-bottom">
          <span class="tok-amount">${t.amount.toFixed(4)} ${t.symbol}</span>
          <span class="${change>=0?'tok-change-pos':'tok-change-neg'}">${change>=0?"+":""}${change}%</span>
        </div>
      </div>`
    container.appendChild(btn)
  })
}

function renderTokenAmountList() {
  const list=document.getElementById("token-amount-list")
  if(!list) return
  list.innerHTML=""
  tokens.forEach((t,i)=>{
    const img=tokenImages[t.symbol]
    const bg=tokenBg[t.symbol]||"#6c4cff"
    const fullName=tokenFullNames[t.symbol]||t.symbol
    const logoHTML=img?`<img src="${img}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`:`<span style="font-size:14px;font-weight:700;color:#fff;">${t.symbol[0]}</span>`
    list.innerHTML+=`
      <div class="tok-setting-row">
        <div class="tok-setting-header">
          <div class="tok-setting-logo" style="background:${bg}">${logoHTML}</div>
          <span class="tok-setting-name">${fullName} (${t.symbol})</span>
        </div>
        <div class="tok-setting-input-row">
          <span class="tok-setting-input-label">Amount</span>
          <input class="tok-setting-input" type="number" value="${t.amount}" id="tok-amt-${i}" placeholder="0"/>
        </div>
      </div>`
  })
}

async function openDetail(i) {
  currentDetailIndex=i
  const t=tokens[i]
  const img=tokenImages[t.symbol]
  const bg=tokenBg[t.symbol]||"#6c4cff"
  const p=currentPrices[t.symbol]
  const usdVal=p?t.amount*p.usd:0
  const change=p?parseFloat(p.change.toFixed(2)):0
  const isPos=change>=0

  const logoEl=document.getElementById("detail-logo")
  logoEl.style.background=bg
  logoEl.innerHTML=img?`<img src="${img}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">`:`<span style="font-size:16px;font-weight:700;color:#fff">${t.symbol[0]}</span>`

  document.getElementById("detail-name").innerText=tokenFullNames[t.symbol]||t.symbol
  const tokenPrice=p?p.usd:0
  document.getElementById("detail-price").innerText="$"+tokenPrice.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:6})
  document.getElementById("detail-balance").innerText=t.amount.toFixed(4)+" "+t.symbol
  document.getElementById("detail-value").innerText="$"+usdVal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})

  const returnEl=document.getElementById("detail-return")
  const dailyReturn=usdVal*(Math.abs(change)/100)
  returnEl.innerText=(isPos?"+$":"-$")+dailyReturn.toFixed(2)
  returnEl.className="position-value "+(isPos?"green":"")

  const changeValEl=document.getElementById("detail-change-val")
  const changePctEl=document.getElementById("detail-change-pct")
  const priceChange=tokenPrice*(Math.abs(change)/100)
changeValEl.innerText=(isPos?"+$":"-$")+priceChange.toFixed(2)
  changeValEl.className=isPos?"change-positive":"change-negative"
  changePctEl.innerText=(isPos?"+":"")+change+"%"
  changePctEl.className="change-badge "+(isPos?"badge-positive":"badge-negative")

  const peopleEl=document.getElementById("detail-people")
  if(peopleEl) peopleEl.innerText="● "+Math.floor(Math.random()*200+50)+" people here"

  const txList=document.getElementById("detail-tx-list")
  const tokenTxs=transactions.filter(tx=>tx.symbol===t.symbol)
  txList.innerHTML=tokenTxs.length===0
    ?'<div style="color:#9b9bab;font-size:13px;text-align:center;padding:20px 0;">No activity yet</div>'
    :tokenTxs.slice(0,5).map(tx=>`
      <div class="detail-tx">
        <div class="detail-tx-left">
          <div class="type">${tx.type.replace('⬆ ','').replace('⬇ ','').replace('⇄ ','')}</div>
          <div class="time">${tx.time}</div>
        </div>
        <div class="${tx.type.includes('Sent')?'tok-change-neg':'tok-change-pos'}">${tx.type.includes('Sent')?'-':'+'}${tx.amount} ${tx.symbol}</div>
      </div>`).join("")

  const screen=document.getElementById("detailScreen")
  screen.style.display="flex"
  requestAnimationFrame(()=>screen.classList.add("open"))

  currentTf="1D"
  document.querySelectorAll(".tf-btn").forEach(b=>b.classList.remove("active"))
  document.querySelectorAll(".tf-btn")[1]?.classList.add("active")
  loadChart(t.symbol,isPos)
}

function closeDetail() {
  const screen=document.getElementById("detailScreen")
  screen.classList.remove("open")
  setTimeout(()=>{screen.style.display="none"},350)
}

async function setTf(btn,tf) {
  document.querySelectorAll(".tf-btn").forEach(b=>b.classList.remove("active"))
  btn.classList.add("active")
  currentTf=tf
  if(currentDetailIndex>=0){
    const t=tokens[currentDetailIndex]
    const p=currentPrices[t.symbol]
    await loadChart(t.symbol,p?p.change>=0:true)
  }
}

function renderMemecoins() {
  const grid=document.getElementById("memecoin-grid")
  if(!grid) return
  grid.innerHTML=""
  memecoins.forEach(m=>{
    const chip=document.createElement("div")
    chip.className="memecoin-chip"
    chip.innerHTML=m.symbol
    chip.onclick=()=>{
      if(tokens.find(t=>t.symbol===m.symbol)) return alert(m.symbol+" already added!")
      tokens.push({symbol:m.symbol,amount:m.amount})
      saveAndRender()
      alert(m.symbol+" added!")
    }
    grid.appendChild(chip)
  })
}

function renderCoinRows() {
  const container=document.getElementById("coin-rows")
  if(!container) return
  container.innerHTML=""
  notifCoins.forEach(coin=>{
    const row=document.createElement("div")
    row.className="coin-row"
    row.innerHTML=`
      <div class="coin-row-left">
        <input type="checkbox" class="coin-check" id="chk-${coin}" ${coin==="SOL"?"checked":""}>
        <label class="coin-label" for="chk-${coin}">${coin}</label>
      </div>
      <div class="range-inputs">
        <input type="number" class="range-input" id="min-${coin}" value="125" placeholder="min">
        <span style="color:#555">-</span>
        <input type="number" class="range-input" id="max-${coin}" value="852" placeholder="max">
      </div>`
    container.appendChild(row)
  })
}

function renderTxList() {
  const box=document.getElementById("tx-list")
  if(!box) return
  box.innerHTML=""
  if(transactions.length===0){
    box.innerHTML='<div style="color:#9b9bab;font-size:13px;text-align:center;padding:16px;">No transactions yet</div>'
    return
  }
  const groups={}
  transactions.forEach(t=>{
    const d=new Date(t.time)
    const today=new Date()
    const yesterday=new Date(today)
    yesterday.setDate(yesterday.getDate()-1)
    let label=d.toLocaleDateString()
    if(d.toDateString()===today.toDateString()) label="Today"
    else if(d.toDateString()===yesterday.toDateString()) label="Yesterday"
    if(!groups[label]) groups[label]=[]
    groups[label].push(t)
  })
  Object.entries(groups).forEach(([date,txs])=>{
    const dateDiv=document.createElement("div")
    dateDiv.className="activity-date"
    dateDiv.innerText=date
    box.appendChild(dateDiv)
    txs.forEach(t=>{
      const globalIndex=transactions.indexOf(t)
      const isSent=t.type.includes("Sent")
      const img=tokenImages[t.symbol]
      const bg=tokenBg[t.symbol]||"#6c4cff"
      const logoHTML=img?`<img src="${img}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`:`<span style="font-size:16px;font-weight:700;color:#fff;">${t.symbol[0]}</span>`
      const div=document.createElement("div")
      div.className="activity-item"
      div.innerHTML=`
        <div class="act-icon-wrap">
          <div class="act-tok-logo" style="background:${bg}">${logoHTML}</div>
          <div class="act-direction ${isSent?'sent':'received'}">${isSent?'↑':'↓'}</div>
        </div>
        <div class="act-info">
          <div class="act-type">${t.type.replace('⬆ ','').replace('⬇ ','').replace('⇄ ','')}</div>
          <div class="act-addr">${isSent?'To':'From'} ${t.address||'429S...2qaL'}</div>
        </div>
        <div style="text-align:right;">
          <div class="${isSent?'act-amount-neg':'act-amount-pos'}">${isSent?'-':'+'}${t.amount} ${t.symbol}</div>
          <button onclick="deleteTx(${globalIndex})" style="background:none;border:none;color:#e5484d;font-size:11px;cursor:pointer;margin-top:4px;">✕</button>
        </div>`
      box.appendChild(div)
    })
  })
}

function deleteTx(i) {
  transactions.splice(i,1)
  localStorage.setItem("transactions",JSON.stringify(transactions))
  renderTxList()
}

function addCustomTx() {
  const type=document.getElementById("tx-type").value
  const symbol=document.getElementById("tx-symbol").value.toUpperCase()
  const address=document.getElementById("tx-to").value||"429S...2qaL"
  const amount=parseFloat(document.getElementById("tx-amount").value)
  const dateVal=document.getElementById("tx-date").value
  if(!symbol||isNaN(amount)) return alert("Fill in all fields")
  const time=dateVal?new Date(dateVal).toLocaleString():new Date().toLocaleString()
  transactions.unshift({
    type:type==="Sent"?"⬆ Sent":type==="Received"?"⬇ Received":"⇄ Swapped",
    symbol,amount:amount.toFixed(4),time,address
  })
  localStorage.setItem("transactions",JSON.stringify(transactions))
  renderTxList()
}

function addCustomToken() {
  const symbol=document.getElementById("custom-symbol").value.toUpperCase()
  const amount=parseFloat(document.getElementById("custom-amount").value)
  if(!symbol||isNaN(amount)) return alert("Fill in all fields")
  if(tokens.find(t=>t.symbol===symbol)) return alert("Token already exists!")
  tokens.push({symbol,amount})
  saveAndRender()
  document.getElementById("custom-symbol").value=""
  document.getElementById("custom-amount").value=""
  alert(symbol+" added!")
}

async function addByContract() {
  const contract = document.getElementById("custom-contract").value.trim()
  if (!contract) return alert("Enter a contract address")
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contract}`)
    const data = await res.json()
    const pair = data.pairs?.[0]
    if (!pair) return alert("Token not found! Check the address.")
    const symbol = pair.baseToken.symbol.toUpperCase().slice(0, 10)
    const name = pair.baseToken.name
    const priceUsd = parseFloat(pair.priceUsd || "0")
    const logoUrl = pair.info?.imageUrl || ""
    if (tokens.find(t => t.symbol === symbol)) return alert(symbol + " already exists!")
    tokens.push({ symbol, amount: 0, logoUrl })
    tokenFullNames[symbol] = name
    if (priceUsd > 0) currentPrices[symbol] = { usd: priceUsd, change: parseFloat(pair.priceChange?.h24 || "0") }
    const colors = ["#9945ff","#f7931a","#627eea","#30a46c","#e5484d","#f3ba2f","#3d9e3d"]
    tokenBg[symbol] = colors[Math.floor(Math.random() * colors.length)]
    saveAndRender()
    document.getElementById("custom-contract").value = ""
    alert(symbol + " (" + name + ") added!")
  } catch(e) {
    alert("Could not fetch token. Check the address and try again.")
  }
}

function saveAndRender() {
  localStorage.setItem("tokens",JSON.stringify(tokens))
  renderTokens()
  syncToServer()
}

async function syncToServer() {
  try {
    await fetch("http://localhost:3000/update", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        key,
        tokens,
        transactions,
        username: localStorage.getItem("username")||"My Wallet",
        balance: parseFloat(localStorage.getItem("customBalance")||"0")
      })
    })
  } catch(e) {
    console.log("Sync failed", e)
  }
}

function openSend() {
  selectedSendIndex=-1
  document.getElementById("send-search").value=""
  document.getElementById("send-amount-section").style.display="none"
  renderSendTokenList(tokens)
  showSheet("sendSheet")
}

function renderSendTokenList(list) {
  const container=document.getElementById("send-token-list")
  container.innerHTML=""
  list.forEach(t=>{
    const realIndex=tokens.indexOf(t)
    const img=tokenImages[t.symbol]||t.logoUrl||""
    const bg=tokenBg[t.symbol]||"#6c4cff"
    const p=currentPrices[t.symbol]
    const usdVal=p?(t.amount*p.usd).toFixed(2):"0.00"
    const logoHTML=img?`<img src="${img}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`:`<span style="font-size:14px;font-weight:700;color:#fff;">${t.symbol[0]}</span>`
    const item=document.createElement("div")
    item.className="token-search-item"+(realIndex===selectedSendIndex?" selected":"")
    item.innerHTML=`
      <div class="token-search-logo" style="background:${bg}">${logoHTML}</div>
      <div style="flex:1;">
        <div class="token-search-name">${tokenFullNames[t.symbol]||t.symbol}</div>
        <div class="token-search-bal">${t.amount.toFixed(4)} ${t.symbol}</div>
      </div>
      <div class="token-search-usd">$${usdVal}</div>`
    item.onclick=()=>{
      selectedSendIndex=realIndex
      document.getElementById("send-amount").value=""
      document.getElementById("send-balance").innerText=`Available: ${tokens[realIndex].amount.toFixed(4)} ${tokens[realIndex].symbol}`
      document.getElementById("send-amount-section").style.display="block"
      renderSendTokenList(list)
    }
    container.appendChild(item)
  })
}

function filterSendTokens(val) {
  const filtered=tokens.filter(t=>
    t.symbol.toLowerCase().includes(val.toLowerCase())||
    (tokenFullNames[t.symbol]||"").toLowerCase().includes(val.toLowerCase())
  )
  renderSendTokenList(filtered)
}

function confirmSend() {
  if(selectedSendIndex===-1) return alert("Select a token first")
  const amount=parseFloat(document.getElementById("send-amount").value)
  if(isNaN(amount)||amount<=0) return alert("Enter a valid amount")
  if(amount>tokens[selectedSendIndex].amount) return alert("Not enough balance!")
  tokens[selectedSendIndex].amount-=amount
  transactions.unshift({type:"⬆ Sent",symbol:tokens[selectedSendIndex].symbol,amount:amount.toFixed(4),time:new Date().toLocaleString(),address:"429S...2qaL"})
  saveAndRender()
  localStorage.setItem("transactions",JSON.stringify(transactions))
  closeAll()
}

function openReceive() {
  selectedReceiveIndex=-1
  document.getElementById("receive-search").value=""
  document.getElementById("receive-amount-section").style.display="none"
  drawQR("qrCanvas",walletAddress)
  document.getElementById("qr-addr-short").innerText=shortAddr(walletAddress)
  renderReceiveTokenList(tokens)
  showSheet("receiveSheet")
}

function renderReceiveTokenList(list) {
  const container=document.getElementById("receive-token-list")
  container.innerHTML=""
  list.forEach(t=>{
    const realIndex=tokens.indexOf(t)
    const img=tokenImages[t.symbol]||t.logoUrl||""
tokenImages[t.symbol]||t.logoUrl||""
    const bg=tokenBg[t.symbol]||"#6c4cff"
    const logoHTML=img?`<img src="${img}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`:`<span style="font-size:14px;font-weight:700;color:#fff;">${t.symbol[0]}</span>`
    const item=document.createElement("div")
    item.className="token-search-item"+(realIndex===selectedReceiveIndex?" selected":"")
    item.innerHTML=`
      <div class="token-search-logo" style="background:${bg}">${logoHTML}</div>
      <div style="flex:1;">
        <div class="token-search-name">${tokenFullNames[t.symbol]||t.symbol}</div>
        <div class="token-search-bal">${t.amount.toFixed(4)} ${t.symbol}</div>
      </div>`
    item.onclick=()=>{
      selectedReceiveIndex=realIndex
      document.getElementById("receive-amount").value=""
      document.getElementById("receive-amount-section").style.display="block"
      renderReceiveTokenList(list)
    }
    container.appendChild(item)
  })
}

function filterReceiveTokens(val) {
  const filtered=tokens.filter(t=>
    t.symbol.toLowerCase().includes(val.toLowerCase())||
    (tokenFullNames[t.symbol]||"").toLowerCase().includes(val.toLowerCase())
  )
  renderReceiveTokenList(filtered)
}

function confirmReceive() {
  if(selectedReceiveIndex===-1) return alert("Select a token first")
  const amount=parseFloat(document.getElementById("receive-amount").value)
  if(isNaN(amount)||amount<=0) return alert("Enter a valid amount")
  tokens[selectedReceiveIndex].amount+=amount
  transactions.unshift({type:"⬇ Received",symbol:tokens[selectedReceiveIndex].symbol,amount:amount.toFixed(4),time:new Date().toLocaleString(),address:shortAddr(walletAddress)})
  saveAndRender()
  localStorage.setItem("transactions",JSON.stringify(transactions))
  closeAll()
}

function copyAddr() {
  navigator.clipboard.writeText(walletAddress)
  alert("Address copied!")
}

function openSettings() {
  const username=localStorage.getItem("username")||"My Wallet"
  const handle=localStorage.getItem("handle")||username.toLowerCase().replace(/\s/g,"")
  const emoji=localStorage.getItem("emoji")||"😭"
  document.getElementById("set-username").value=handle
  document.getElementById("set-name").value=username
  document.getElementById("set-cash").value=localStorage.getItem("cashBalance")||"0"
  document.getElementById("set-balance").value=localStorage.getItem("customBalance")||""
  document.getElementById("emoji-display").innerText=emoji
  document.getElementById("auto-sol").value=localStorage.getItem("autoSol")||"0"
  document.getElementById("auto-every").value=localStorage.getItem("autoEvery")||"3"
  const autoEvery=localStorage.getItem("autoEvery")||"3"
  document.getElementById("auto-progress").innerText=autoRefreshCount+" / "+autoEvery
  renderTokenAmountList()
  renderMemecoins()
  showSheet("settingsSheet")
}

function changeEmoji() {
  const emojis=["😭","👻","🦊","🐸","💎","🚀","🦁","🐉","⚡","🌙","🔥","💀"]
  const current=document.getElementById("emoji-display").innerText
  const idx=emojis.indexOf(current)
  document.getElementById("emoji-display").innerText=emojis[(idx+1)%emojis.length]
}

function applySettings() {
  const username=document.getElementById("set-name").value
  const handle=document.getElementById("set-username").value.replace("@","")
  const emoji=document.getElementById("emoji-display").innerText
  const cashBalance=parseFloat(document.getElementById("set-cash").value||"0")
  const customBalance=parseFloat(document.getElementById("set-balance").value||"0")
  const autoSol=document.getElementById("auto-sol").value
  const autoEvery=document.getElementById("auto-every").value

  if(username){
    localStorage.setItem("username",username)
    localStorage.setItem("handle",handle)
    localStorage.setItem("emoji",emoji)
    updateHeaderDisplay(username,handle,emoji)
  }

  localStorage.setItem("cashBalance",cashBalance)
  localStorage.setItem("autoSol",autoSol)
  localStorage.setItem("autoEvery",autoEvery)

  const cashEl=document.getElementById("cash-display")
  if(cashEl) cashEl.innerText="$"+cashBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})

  if(customBalance>0){
    localStorage.setItem("customBalance",customBalance)
    animateBalance(customBalance)
  } else {
    localStorage.removeItem("customBalance")
  }

  tokens.forEach((t,i)=>{
    const input=document.getElementById(`tok-amt-${i}`)
    if(input){
      const newAmt=parseFloat(input.value)
      if(!isNaN(newAmt)) tokens[i].amount=newAmt
    }
  })

  saveAndRender()
    syncToServer()
  closeAll()
}

function triggerAutoBalance() {
  const autoSol=parseFloat(document.getElementById("auto-sol")?.value||"0")
  const autoEvery=parseInt(document.getElementById("auto-every")?.value||"3")
  autoRefreshCount++
  localStorage.setItem("autoRefreshCount",autoRefreshCount)
  const progressEl=document.getElementById("auto-progress")
  if(progressEl) progressEl.innerText=autoRefreshCount+" / "+autoEvery
  if(autoRefreshCount>=autoEvery&&autoSol>0){
    const solIndex=tokens.findIndex(t=>t.symbol==="SOL")
    if(solIndex>=0){
      tokens[solIndex].amount+=autoSol
      saveAndRender()
      autoRefreshCount=0
      localStorage.setItem("autoRefreshCount","0")
      if(progressEl) progressEl.innerText="0 / "+autoEvery
    }
  }
}

function resetAutoBalance() {
  autoRefreshCount=0
  localStorage.setItem("autoRefreshCount","0")
  const autoEvery=document.getElementById("auto-every")?.value||"3"
  const progressEl=document.getElementById("auto-progress")
  if(progressEl) progressEl.innerText="0 / "+autoEvery
  if(document.getElementById("auto-sol")) document.getElementById("auto-sol").value="0"
  if(document.getElementById("auto-every")) document.getElementById("auto-every").value="3"
  alert("Counter reset!")
}

function setMode(mode) {
  if(mode==="manual"||mode==="auto"){
    notifMode.type=mode
    document.getElementById("mode-manual").className="mode-chip"+(mode==="manual"?" active":"")
    document.getElementById("mode-auto").className="mode-chip"+(mode==="auto"?" active":"")
  }
  if(mode==="random"||mode==="fixed"){
    notifMode.amount=mode
    document.getElementById("mode-random").className="mode-chip"+(mode==="random"?" active":"")
    document.getElementById("mode-fixed").className="mode-chip"+(mode==="fixed"?" active":"")
  }
}

function getSelectedCoins(){return notifCoins.filter(c=>document.getElementById("chk-"+c)?.checked)}

function buildNotifData() {
  const selected=getSelectedCoins()
  if(selected.length===0) return null
  const coin=selected[Math.floor(Math.random()*selected.length)]
  const min=parseFloat(document.getElementById("min-"+coin)?.value||1)
  const max=parseFloat(document.getElementById("max-"+coin)?.value||100)
  const amount=notifMode.amount==="random"?(Math.random()*(max-min)+min).toFixed(2):((min+max)/2).toFixed(2)
  return{coin,amount}
}

function fireNotifNow() {
  const data=buildNotifData()
  if(!data) return alert("Select at least one coin!")
  const title="Notification from Phantom"
  const body=`Received ${data.amount} ${data.coin}`
  if(Notification.permission==="granted"){
    new Notification(title,{body,icon:"icon-192.png"})
  } else {
    Notification.requestPermission().then(p=>{if(p==="granted") new Notification(title,{body})})
  }
}

function startAutoNotif() {
  if(Notification.permission!=="granted"){
    Notification.requestPermission().then(p=>{if(p==="granted")startAutoNotif()})
    return
  }
  const interval=parseInt(document.getElementById("notif-interval").value||5)
  const unit=parseInt(document.getElementById("notif-unit").value||1)
  const ms=interval*unit*1000
  if(notifMode.type==="manual"){fireNotifNow();return}
  stopAutoNotif()
  fireNotifNow()
  autoNotifTimer=setInterval(fireNotifNow,ms)
  document.getElementById("start-notif-btn").style.display="none"
  document.getElementById("stop-notif-btn").style.display="block"
}

function stopAutoNotif() {
  if(autoNotifTimer){clearInterval(autoNotifTimer);autoNotifTimer=null}
  const s=document.getElementById("start-notif-btn")
  const e=document.getElementById("stop-notif-btn")
  if(s)s.style.display="block"
  if(e)e.style.display="none"
}

function requestNotifPermission() {
  Notification.requestPermission().then(p=>{
    const el=document.getElementById("notif-permission")
    if(p==="granted"){el.innerText="Enabled ✓";el.style.borderColor="#30a46c";el.style.color="#30a46c"}
    else{el.innerText="Blocked ✗";el.style.borderColor="#e5484d";el.style.color="#e5484d"}
  })
}

function swap(){alert("Swap coming soon!")}

function logout(){
  stopAutoNotif()
  localStorage.clear()
  window.location="login.html"
}

function openTx(){renderTxList();showSheet("txSheet")}
function openNotif(){showSheet("notifSheet")}

function openLicense(){
  const lic=licenseData
  const planEl=document.getElementById("lic-plan")
  const daysEl=document.getElementById("lic-days")
  const expiresEl=document.getElementById("lic-expires")
  const statusEl=document.getElementById("lic-status")
  if(!lic||!lic.plan){
    planEl.innerText="No License";daysEl.innerText="0"
    statusEl.innerText="❌ Inactive";statusEl.style.color="#e5484d"
    showSheet("licenseSheet");return
  }
  if(lic.plan==="lifetime"){
    planEl.innerText="Lifetime ♾️";daysEl.innerText="∞"
    expiresEl.innerText="Never expires"
    statusEl.innerText="✅ Active";statusEl.style.color="#30a46c"
  } else {
    const expiry=new Date(lic.expiryDate)
    const diff=Math.ceil((expiry-new Date())/(1000*60*60*24))
    planEl.innerText=lic.days+" Day Plan"
    daysEl.innerText=diff>0?diff+" days left":"Expired"
    expiresEl.innerText="Expires: "+expiry.toLocaleDateString()
    statusEl.innerText=diff>0?"✅ Active":"❌ Expired"
    statusEl.style.color=diff>0?"#30a46c":"#e5484d"
  }
  showSheet("licenseSheet")
}

function showSheet(id){
  const sheet=document.getElementById(id)
  const overlay=document.getElementById("overlay")
  document.querySelectorAll(".sheet").forEach(s=>{s.classList.remove("open");s.style.display="none"})
  sheet.style.display="block"
  overlay.style.display="block"
  sheetJustOpened=true
  setTimeout(()=>{sheet.classList.add("open");overlay.classList.add("visible")},10)
  setTimeout(()=>{sheetJustOpened=false},500)
}

function closeAll(){
  if(sheetJustOpened) return
  document.querySelectorAll(".sheet").forEach(s=>{
    s.classList.remove("open")
    setTimeout(()=>{s.style.display="none"},350)
  })
  const overlay=document.getElementById("overlay")
  overlay.classList.remove("visible")
  setTimeout(()=>{overlay.style.display="none"},300)
}

async function updatePrices(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/ticker/24hr?symbols=[%22SOLUSDT%22,%22BTCUSDT%22,%22ETHUSDT%22,%22BNBUSDT%22,%22PEPEUSDT%22,%22DOGEUSDT%22,%22SHIBUSDT%22,%22WIFUSDT%22,%22BONKUSDT%22,%22FLOKIUSDT%22]")
    const data=await res.json()
    data.forEach(t=>{
      const symbol=t.symbol.replace("USDT","")
      currentPrices[symbol]={usd:parseFloat(t.lastPrice),change:parseFloat(t.priceChangePercent)}
    })
    currentPrices["USDT"]={usd:1,change:0}
    currentPrices["USDC"]={usd:1,change:0}

    const customBalance=parseFloat(localStorage.getItem("customBalance")||"0")
    let total=0
    tokens.forEach(t=>{
      const p=currentPrices[t.symbol]
      if(p) total+=t.amount*p.usd
    })

    renderTokens()
    if(customBalance<=0) animateBalance(total)

    const diff=total-previousTotal
    const pct=previousTotal>0?((diff/previousTotal)*100).toFixed(2):"0.00"
    const changeEl=document.getElementById("change")
    const pctEl=document.getElementById("pct")
    if(changeEl){changeEl.innerText=(diff>=0?"+$":"-$")+Math.abs(diff).toFixed(2);changeEl.className=diff>=0?"change-positive":"change-negative"}
    if(pctEl){pctEl.innerText=(pct>=0?"+":"")+pct+"%";pctEl.className="change-badge "+(pct>=0?"badge-positive":"badge-negative")}
    if(previousTotal===0) previousTotal=total

    const autoEvery=parseInt(localStorage.getItem("autoEvery")||"3")
    const autoSol=parseFloat(localStorage.getItem("autoSol")||"0")
    if(autoSol>0){
      autoRefreshCount++
      localStorage.setItem("autoRefreshCount",autoRefreshCount)
      if(autoRefreshCount>=autoEvery){
        const solIndex=tokens.findIndex(t=>t.symbol==="SOL")
        if(solIndex>=0){
          tokens[solIndex].amount+=autoSol
          saveAndRender()
          autoRefreshCount=0
          localStorage.setItem("autoRefreshCount","0")
        }
      }
    }
  } catch(e){
    console.log("Price fetch failed",e)
    renderTokens()
  }
}

if(window.location.pathname.includes("dashboard")){
  load()
}