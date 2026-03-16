#!/usr/bin/env python3
"""SubTracker Setup Script - Run with: python3 setup.py"""
import os, shutil

def write(path, content):
    d = os.path.dirname(path)
    if d: os.makedirs(d, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  created: {path}")

# Clean up any conflicting default files
for p in ['pages/api/hello.js']:
    if os.path.exists(p): os.remove(p)

print("Building SubTracker...\n")

# ── PACKAGE.JSON ─────────────────────────────────────────────
write('package.json', """{
  "name": "subcontract-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:setup": "npx prisma generate && npx prisma db push"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "@prisma/client": "5.17.0",
    "bcryptjs": "2.4.3",
    "jsonwebtoken": "9.0.2",
    "cookie": "0.6.0"
  },
  "devDependencies": {
    "prisma": "5.17.0"
  }
}
""")

write('next.config.js', """/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }
module.exports = nextConfig
""")

write('jsconfig.json', """{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
""")

write('.env.local', """DATABASE_URL="file:./dev.db"
JWT_SECRET="change-this-to-something-long-and-random-before-sharing"
""")

# ── PRISMA SCHEMA ─────────────────────────────────────────────
write('prisma/schema.prisma', """generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         String
  companyName  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  gcProjects     Project[]       @relation("GCProjects")
  projectMembers ProjectMember[]
  bids           Bid[]
  subcontracts   Subcontract[]
}

model Project {
  id        String   @id @default(cuid())
  name      String
  gcId      String
  status    String   @default("BIDDING")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  gc           User            @relation("GCProjects", fields: [gcId], references: [id])
  members      ProjectMember[]
  bids         Bid[]
  subcontracts Subcontract[]
  planFiles    PlanFile[]
}

model ProjectMember {
  id            String   @id @default(cuid())
  projectId     String
  userId        String
  roleOnProject String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id])
  user    User    @relation(fields: [userId], references: [id])

  @@unique([projectId, userId])
}

model PlanFile {
  id          String   @id @default(cuid())
  projectId   String
  fileUrl     String
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id])
}

model Bid {
  id        String   @id @default(cuid())
  projectId String
  subId     String
  amount    Float
  status    String   @default("PENDING")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id])
  sub     User    @relation(fields: [subId], references: [id])
}

model Subcontract {
  id                 String   @id @default(cuid())
  projectId          String
  subId              String
  baseContractAmount Float
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  project      Project       @relation(fields: [projectId], references: [id])
  sub          User          @relation(fields: [subId], references: [id])
  changeOrders ChangeOrder[]
  invoices     Invoice[]
}

model ChangeOrder {
  id            String   @id @default(cuid())
  subcontractId String
  description   String
  amount        Float
  status        String   @default("PENDING_SUB")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subcontract Subcontract @relation(fields: [subcontractId], references: [id])
}

model Invoice {
  id                String   @id @default(cuid())
  subcontractId     String
  amount            Float
  status            String   @default("PENDING")
  flaggedOverAmount Float    @default(0)
  overrideReason    String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  subcontract Subcontract @relation(fields: [subcontractId], references: [id])
}
""")

# ── LIB/DB.JS ─────────────────────────────────────────────────
write('lib/db.js', """import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
""")

# ── LIB/AUTH.JS ───────────────────────────────────────────────
write('lib/auth.js', """import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize, parse } from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret'
const COOKIE_NAME = 'auth_token'

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, companyName: user.companyName },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

export function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }))
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', { httpOnly: true, maxAge: 0, path: '/' }))
}

export function getAuthUser(req) {
  const cookies = parse(req.headers.cookie || '')
  const token = cookies[COOKIE_NAME]
  if (!token) return null
  return verifyToken(token)
}
""")

# ── LIB/SCOREBOARD.JS ─────────────────────────────────────────
write('lib/scoreboard.js', """import prisma from './db'

export async function getScoreboard(subcontractId) {
  const sc = await prisma.subcontract.findUnique({
    where: { id: subcontractId },
    include: { changeOrders: true, invoices: true },
  })
  if (!sc) return null
  const base = sc.baseContractAmount
  const coTotal = sc.changeOrders.filter(c => c.status === 'APPROVED').reduce((s, c) => s + c.amount, 0)
  const currentApprovedTotal = base + coTotal
  const invoicedTotal = sc.invoices.filter(i => i.status === 'APPROVED').reduce((s, i) => s + i.amount, 0)
  const remaining = currentApprovedTotal - invoicedTotal
  return { base, coTotal, currentApprovedTotal, invoicedTotal, remaining }
}
""")

# ── STYLES/GLOBALS.CSS ────────────────────────────────────────
write('styles/globals.css', """*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f9; color: #1a202c; }
a { color: inherit; text-decoration: none; }

.container { max-width: 960px; margin: 0 auto; padding: 24px 20px; }

nav { background: #0f172a; color: white; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
nav strong { font-size: 18px; color: #38bdf8; letter-spacing: -0.3px; }
.nav-right { display: flex; align-items: center; gap: 16px; font-size: 14px; color: #94a3b8; }

h1 { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #0f172a; }
h2 { font-size: 16px; font-weight: 700; color: #0f172a; }

button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: opacity .15s; margin-right: 6px; }
button:hover { opacity: .85; }
.btn-primary { background: #2563eb; color: white; }
.btn-success { background: #16a34a; color: white; }
.btn-danger { background: #dc2626; color: white; }
.btn-warning { background: #d97706; color: white; }
.btn-secondary { background: #64748b; color: white; }
.btn-sm { padding: 5px 10px; font-size: 12px; }

input, select, textarea { width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; background: white; color: #1a202c; margin-bottom: 12px; }
input:focus, select:focus, textarea:focus { outline: 2px solid #2563eb; border-color: transparent; }
label { display: block; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .4px; }

.card { background: white; border-radius: 10px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); border: 1px solid #e8ecf0; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }

table { width: 100%; border-collapse: collapse; }
th { padding: 11px 14px; background: #f8fafc; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; text-align: left; border-bottom: 1px solid #e8ecf0; }
td { padding: 13px 14px; font-size: 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafbfc; }

.badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
.badge-green { background: #dcfce7; color: #15803d; }
.badge-red { background: #fee2e2; color: #b91c1c; }
.badge-yellow { background: #fef9c3; color: #a16207; }
.badge-blue { background: #dbeafe; color: #1d4ed8; }
.badge-gray { background: #f1f5f9; color: #475569; }

.scoreboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
.sb-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; text-align: center; }
.sb-item .sb-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; }
.sb-item .sb-value { font-size: 22px; font-weight: 800; color: #1e40af; }
.sb-item.sb-danger { background: #fff1f2; border-color: #fecdd3; }
.sb-item.sb-danger .sb-value { color: #dc2626; }
.sb-item.sb-highlight { background: #f0fdf4; border-color: #bbf7d0; }
.sb-item.sb-highlight .sb-value { color: #16a34a; }

.alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 18px; font-size: 14px; line-height: 1.5; }
.alert-error { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
.alert-success { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.alert-info { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
.alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fcd34d; }

.loading { text-align: center; padding: 60px; color: #94a3b8; font-size: 15px; }
.page-center { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.auth-card { width: 100%; max-width: 400px; }
.auth-card h1 { text-align: center; margin-bottom: 24px; }
.auth-link { text-align: center; margin-top: 16px; font-size: 13px; color: #64748b; }
.auth-link a { color: #2563eb; font-weight: 600; }
.form-row { display: flex; gap: 10px; align-items: flex-start; }
.form-row .grow { flex: 1; }
.form-row button { margin-top: 22px; white-space: nowrap; }
.empty { color: #94a3b8; font-size: 14px; padding: 20px 0; }
.flag-row td { background: #fff7ed; }
.override-block { display: flex; flex-direction: column; gap: 6px; min-width: 260px; }
.override-block input { margin-bottom: 0; }
.override-actions { display: flex; gap: 6px; }
""")

# ── PAGES/_APP.JS ─────────────────────────────────────────────
write('pages/_app.js', """import '@/styles/globals.css'
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
""")

# ── PAGES/INDEX.JS ────────────────────────────────────────────
write('pages/index.js', """import { useEffect } from 'react'
import { useRouter } from 'next/router'
export default function Home() {
  const router = useRouter()
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? router.push('/dashboard') : router.push('/login'))
  }, [])
  return <div className="loading">Loading...</div>
}
""")

# ── PAGES/LOGIN.JS ────────────────────────────────────────────
write('pages/login.js', """import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    router.push('/dashboard')
  }

  return (
    <div className="page-center">
      <div className="card auth-card">
        <h1>SubTracker</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required autoFocus />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
          <button className="btn-primary" type="submit" style={{width:'100%'}} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="auth-link">No account? <Link href="/signup">Sign up</Link></p>
      </div>
    </div>
  )
}
""")

# ── PAGES/SIGNUP.JS ───────────────────────────────────────────
write('pages/signup.js', """import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Signup() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '', role: 'GC', companyName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    router.push('/dashboard')
  }

  return (
    <div className="page-center">
      <div className="card auth-card">
        <h1>Create Account</h1>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>I am a...</label>
          <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
            <option value="GC">General Contractor (GC)</option>
            <option value="SUB">Subcontractor (Sub)</option>
          </select>
          <label>Company Name</label>
          <input value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} placeholder="Your Company LLC" required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} minLength={6} required />
          <button className="btn-primary" type="submit" style={{width:'100%'}} disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-link">Already have an account? <Link href="/login">Log in</Link></p>
      </div>
    </div>
  )
}
""")

# ── PAGES/DASHBOARD.JS ────────────────────────────────────────
write('pages/dashboard.js', """import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const STATUS_BADGE = { BIDDING: 'badge-yellow', CONSTRUCTION: 'badge-blue', COMPLETE: 'badge-green' }

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [projects, setProjects] = useState([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (!r.ok) return router.push('/login')
      return r.json()
    }).then(u => {
      if (!u) return
      setUser(u)
      fetch('/api/projects').then(r => r.json()).then(p => { setProjects(p); setLoading(false) })
    })
  }, [])

  async function createProject(e) {
    e.preventDefault()
    if (!newName.trim()) return
    const res = await fetch('/api/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setProjects([data, ...projects]); setNewName('')
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) return <div className="loading">Loading your projects...</div>

  return (
    <>
      <nav>
        <strong>SubTracker</strong>
        <div className="nav-right">
          <span>{user?.companyName} &mdash; {user?.role}</span>
          <button className="btn-secondary btn-sm" onClick={logout}>Log out</button>
        </div>
      </nav>
      <div className="container">
        <h1 style={{marginTop:24}}>My Projects</h1>

        {user?.role === 'GC' && (
          <div className="card">
            <h2 style={{marginBottom:14}}>Create New Project</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={createProject} className="form-row">
              <div className="grow">
                <label>Project Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. 123 Main St Office Renovation" style={{marginBottom:0}} />
              </div>
              <button className="btn-primary" type="submit">+ Create</button>
            </form>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="card">
            <p className="empty">
              {user?.role === 'GC'
                ? 'No projects yet. Create your first project above.'
                : 'You have not been invited to any projects yet. Ask your GC to add you.'}
            </p>
          </div>
        ) : (
          <div className="card" style={{padding:0}}>
            <table>
              <thead><tr><th>Project</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.name}</strong></td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]||'badge-gray'}`}>{p.status}</span></td>
                    <td style={{textAlign:'right'}}>
                      <Link href={`/project/${p.id}`}><button className="btn-primary btn-sm">Open &rarr;</button></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
""")

# ── PAGES/PROJECT/[ID].JS ─────────────────────────────────────
write('pages/project/[id].js', """import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const fmt = n => '$' + (n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function ProjectPage() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCompany, setInviteCompany] = useState('')
  const [bidAmount, setBidAmount] = useState('')

  async function load() {
    const [ur, pr] = await Promise.all([fetch('/api/auth/me'), fetch(`/api/project/${id}`)])
    if (!ur.ok) return router.push('/login')
    const u = await ur.json(); setUser(u)
    if (pr.ok) setProject(await pr.json())
    setLoading(false)
  }

  useEffect(() => { if (id) load() }, [id])

  async function inviteSub(e) {
    e.preventDefault(); setError(''); setMessage('')
    const res = await fetch(`/api/project/${id}/invite`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: inviteEmail, companyName: inviteCompany }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    let msg = `Added ${data.user.companyName} to this project.`
    if (data.isNew) msg += ` New account created! Temporary password: ${data.tempPassword} — share this with them to log in.`
    setMessage(msg); setInviteEmail(''); setInviteCompany(''); load()
  }

  async function submitBid(e) {
    e.preventDefault(); setError(''); setMessage('')
    const res = await fetch(`/api/project/${id}/bids`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ amount: bidAmount }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setMessage('Bid submitted successfully!'); setBidAmount(''); load()
  }

  async function acceptBid(bidId) {
    setError(''); setMessage('')
    const res = await fetch(`/api/bid/${bidId}/accept`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setMessage('Bid accepted! Subcontract created.'); load()
  }

  async function changeStatus(status) {
    const res = await fetch(`/api/project/${id}`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setProject(p => ({...p, status: data.status}))
  }

  async function logout() {
    await fetch('/api/auth/logout', {method:'POST'}); router.push('/login')
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!project) return <div className="container" style={{marginTop:24}}><p>Project not found.</p></div>

  const isGC = user?.role === 'GC'
  const myBid = isGC ? null : project.bids?.find(b => b.subId === user?.id)
  const STATUS_BADGE = { BIDDING: 'badge-yellow', CONSTRUCTION: 'badge-blue', COMPLETE: 'badge-green' }

  return (
    <>
      <nav>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Link href="/dashboard"><span style={{color:'#94a3b8',fontSize:13}}>&larr; Dashboard</span></Link>
          <strong style={{color:'white'}}>{project.name}</strong>
          <span className={`badge ${STATUS_BADGE[project.status]||'badge-gray'}`}>{project.status}</span>
        </div>
        <div className="nav-right">
          <span>{user?.companyName}</span>
          <button className="btn-secondary btn-sm" onClick={logout}>Log out</button>
        </div>
      </nav>

      <div className="container" style={{marginTop:24}}>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {/* GC phase controls */}
        {isGC && (
          <div style={{marginBottom:20,display:'flex',gap:10}}>
            {project.status === 'BIDDING' && (
              <button className="btn-primary" onClick={() => changeStatus('CONSTRUCTION')}>
                Move to Construction Phase &rarr;
              </button>
            )}
            {project.status === 'CONSTRUCTION' && (
              <button className="btn-success" onClick={() => changeStatus('COMPLETE')}>
                Mark Project Complete
              </button>
            )}
          </div>
        )}

        {/* ===== BIDDING PHASE ===== */}
        {project.status === 'BIDDING' && (
          <>
            {/* GC: Invite Subs */}
            {isGC && (
              <div className="card">
                <h2 style={{marginBottom:14}}>Invite Subcontractor to Bid</h2>
                <form onSubmit={inviteSub}>
                  <div className="form-row">
                    <div className="grow">
                      <label>Sub's Email Address</label>
                      <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                        placeholder="sub@company.com" required style={{marginBottom:0}} />
                    </div>
                    <div className="grow">
                      <label>Company Name (if new user)</label>
                      <input value={inviteCompany} onChange={e=>setInviteCompany(e.target.value)}
                        placeholder="ABC Electrical" style={{marginBottom:0}} />
                    </div>
                    <button className="btn-primary" type="submit">Invite</button>
                  </div>
                </form>
                {project.members?.filter(m => m.roleOnProject === 'SUB').length > 0 && (
                  <div style={{marginTop:12,fontSize:13,color:'#475569'}}>
                    <strong>Invited subs: </strong>
                    {project.members.filter(m=>m.roleOnProject==='SUB').map(m=>m.user.companyName).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* GC: View Bids */}
            {isGC && (
              <div className="card" style={{padding:0}}>
                <div className="card-header" style={{padding:'18px 24px'}}>
                  <h2>Bids Received</h2>
                </div>
                {!project.bids?.length ? (
                  <p className="empty" style={{padding:'0 24px 20px'}}>No bids yet.</p>
                ) : (
                  <table>
                    <thead><tr><th>Company</th><th>Email</th><th>Bid Amount</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {project.bids.map(b => (
                        <tr key={b.id}>
                          <td><strong>{b.sub.companyName}</strong></td>
                          <td style={{color:'#64748b'}}>{b.sub.email}</td>
                          <td><strong>{fmt(b.amount)}</strong></td>
                          <td><span className={`badge ${b.status==='ACCEPTED'?'badge-green':b.status==='REJECTED'?'badge-red':'badge-yellow'}`}>{b.status}</span></td>
                          <td>
                            {b.status === 'PENDING' && (
                              <button className="btn-success btn-sm" onClick={() => acceptBid(b.id)}>
                                Accept &rarr; Create Subcontract
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* SUB: Submit Bid */}
            {!isGC && (
              <div className="card">
                <h2 style={{marginBottom:14}}>Your Bid</h2>
                {myBid ? (
                  <div>
                    <p style={{marginBottom:10}}>You submitted a bid of <strong>{fmt(myBid.amount)}</strong>.</p>
                    <span className={`badge ${myBid.status==='ACCEPTED'?'badge-green':myBid.status==='REJECTED'?'badge-red':'badge-yellow'}`}>
                      {myBid.status === 'PENDING' ? 'Awaiting GC Review' : myBid.status}
                    </span>
                    {myBid.status === 'ACCEPTED' && <p style={{marginTop:10,fontSize:14,color:'#15803d'}}>Your bid was accepted! A subcontract has been created. Once the GC moves the project to Construction, you will see your subcontract details here.</p>}
                  </div>
                ) : (
                  <form onSubmit={submitBid}>
                    <div className="form-row">
                      <div className="grow">
                        <label>Your Bid Amount ($)</label>
                        <input type="number" value={bidAmount} onChange={e=>setBidAmount(e.target.value)}
                          min="0" step="0.01" placeholder="e.g. 75000" required style={{marginBottom:0}} />
                      </div>
                      <button className="btn-primary" type="submit">Submit Bid</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== CONSTRUCTION PHASE ===== */}
        {project.status === 'CONSTRUCTION' && (
          <div className="card" style={{padding:0}}>
            <div className="card-header" style={{padding:'18px 24px'}}>
              <h2>Subcontracts</h2>
            </div>
            {!project.subcontracts?.length ? (
              <p className="empty" style={{padding:'0 24px 20px'}}>
                {isGC ? 'No subcontracts yet. Go back to Bidding phase to accept bids.' : 'No subcontracts found.'}
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Subcontractor</th>
                    <th>Base Contract</th>
                    <th>CO Total</th>
                    <th>Approved Total</th>
                    <th>Invoiced</th>
                    <th>Remaining</th>
                    <th>Flags</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {project.subcontracts.map(sc => (
                    <tr key={sc.id} className={sc.hasFlaggedInvoices ? 'flag-row' : ''}>
                      <td><strong>{sc.sub.companyName}</strong></td>
                      <td>{fmt(sc.scoreboard?.base)}</td>
                      <td>{fmt(sc.scoreboard?.coTotal)}</td>
                      <td><strong>{fmt(sc.scoreboard?.currentApprovedTotal)}</strong></td>
                      <td>{fmt(sc.scoreboard?.invoicedTotal)}</td>
                      <td style={{fontWeight:700,color:(sc.scoreboard?.remaining||0)<0?'#dc2626':'#16a34a'}}>
                        {fmt(sc.scoreboard?.remaining)}
                      </td>
                      <td>
                        {sc.hasFlaggedInvoices
                          ? <span className="badge badge-red">&#9888; Flagged</span>
                          : <span className="badge badge-green">&#10003; OK</span>}
                      </td>
                      <td style={{textAlign:'right'}}>
                        <Link href={`/subcontract/${sc.id}`}><button className="btn-primary btn-sm">View &rarr;</button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ===== COMPLETE PHASE ===== */}
        {project.status === 'COMPLETE' && (
          <div className="card">
            <p style={{marginBottom:16,color:'#15803d',fontWeight:600}}>&#10003; This project is marked complete.</p>
            {project.subcontracts?.length > 0 && (
              <>
                <h2 style={{marginBottom:14}}>Final Subcontract Summary</h2>
                <table>
                  <thead><tr><th>Subcontractor</th><th>Base</th><th>CO Total</th><th>Approved Total</th><th>Invoiced</th><th>Remaining</th></tr></thead>
                  <tbody>
                    {project.subcontracts.map(sc => (
                      <tr key={sc.id}>
                        <td>{sc.sub.companyName}</td>
                        <td>{fmt(sc.scoreboard?.base)}</td>
                        <td>{fmt(sc.scoreboard?.coTotal)}</td>
                        <td><strong>{fmt(sc.scoreboard?.currentApprovedTotal)}</strong></td>
                        <td>{fmt(sc.scoreboard?.invoicedTotal)}</td>
                        <td style={{fontWeight:700}}>{fmt(sc.scoreboard?.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
""")

# ── PAGES/SUBCONTRACT/[ID].JS ─────────────────────────────────
write('pages/subcontract/[id].js', """import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

const fmt = n => '$' + (n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})

export default function SubcontractPage() {
  const router = useRouter()
  const { id } = router.query
  const [user, setUser] = useState(null)
  const [sc, setSc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showCOForm, setShowCOForm] = useState(false)
  const [coForm, setCoForm] = useState({ description: '', amount: '' })
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [overrideReasons, setOverrideReasons] = useState({})

  async function load() {
    const [ur, sr] = await Promise.all([fetch('/api/auth/me'), fetch(`/api/subcontract/${id}`)])
    if (!ur.ok) return router.push('/login')
    setUser(await ur.json())
    if (sr.ok) setSc(await sr.json())
    setLoading(false)
  }

  useEffect(() => { if (id) load() }, [id])

  async function respondCO(coId, action) {
    setError(''); setMessage('')
    const res = await fetch(`/api/change-order/${coId}/respond`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setMessage(`Change order ${action === 'APPROVED' ? 'approved' : 'rejected'}.`); load()
  }

  async function createCO(e) {
    e.preventDefault(); setError(''); setMessage('')
    const res = await fetch(`/api/subcontract/${id}/change-orders`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(coForm),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setMessage('Change order sent to sub for approval.')
    setCoForm({ description: '', amount: '' }); setShowCOForm(false); load()
  }

  async function submitInvoice(e) {
    e.preventDefault(); setError(''); setMessage('')
    const res = await fetch(`/api/subcontract/${id}/invoices`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ amount: invoiceAmount }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    if (data.status === 'APPROVED') {
      setMessage('Invoice submitted and automatically approved.')
    } else {
      setMessage(`Invoice flagged: it exceeds your approved total by ${fmt(data.flaggedOverAmount)}. The GC will review it.`)
    }
    setInvoiceAmount(''); load()
  }

  async function invoiceAction(invoiceId, action) {
    setError(''); setMessage('')
    const reason = overrideReasons[invoiceId] || ''
    if (action === 'OVERRIDE' && !reason.trim()) return setError('You must enter an override reason before approving.')
    const res = await fetch(`/api/invoice/${invoiceId}/action`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action, overrideReason: reason }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error)
    setMessage(action === 'REJECT' ? 'Invoice rejected.' : 'Invoice approved with override reason recorded.')
    load()
  }

  async function logout() {
    await fetch('/api/auth/logout', {method:'POST'}); router.push('/login')
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!sc) return <div className="container" style={{marginTop:24}}><p>Subcontract not found.</p></div>

  const isGC = user?.role === 'GC'
  const { scoreboard } = sc

  return (
    <>
      <nav>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <Link href={`/project/${sc.project?.id}`}><span style={{color:'#94a3b8',fontSize:13}}>&larr; Project</span></Link>
          <strong style={{color:'white'}}>Subcontract: {sc.sub?.companyName}</strong>
        </div>
        <div className="nav-right">
          <span>{user?.companyName} &mdash; {user?.role}</span>
          <button className="btn-secondary btn-sm" onClick={logout}>Log out</button>
        </div>
      </nav>

      <div className="container" style={{marginTop:24}}>
        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className={`alert ${message.includes('flagged')||message.includes('rejected') ? 'alert-warning' : 'alert-success'}`}>{message}</div>}

        {/* SCOREBOARD */}
        <h2 style={{marginBottom:14}}>Scoreboard</h2>
        <div className="scoreboard">
          <div className="sb-item">
            <div className="sb-label">Base Contract</div>
            <div className="sb-value">{fmt(scoreboard?.base)}</div>
          </div>
          <div className="sb-item">
            <div className="sb-label">Approved COs</div>
            <div className="sb-value">{fmt(scoreboard?.coTotal)}</div>
          </div>
          <div className="sb-item sb-highlight">
            <div className="sb-label">Approved Total</div>
            <div className="sb-value">{fmt(scoreboard?.currentApprovedTotal)}</div>
          </div>
          <div className="sb-item">
            <div className="sb-label">Total Invoiced</div>
            <div className="sb-value">{fmt(scoreboard?.invoicedTotal)}</div>
          </div>
          <div className={`sb-item ${(scoreboard?.remaining||0) < 0 ? 'sb-danger' : 'sb-highlight'}`}>
            <div className="sb-label">Remaining</div>
            <div className="sb-value">{fmt(scoreboard?.remaining)}</div>
          </div>
        </div>

        {/* CHANGE ORDERS */}
        <div className="card">
          <div className="card-header">
            <h2>Change Orders</h2>
            {isGC && (
              <button className={showCOForm ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                onClick={() => setShowCOForm(!showCOForm)}>
                {showCOForm ? 'Cancel' : '+ New Change Order'}
              </button>
            )}
          </div>

          {isGC && showCOForm && (
            <form onSubmit={createCO} style={{background:'#f8fafc',padding:18,borderRadius:8,marginBottom:18}}>
              <label>Description</label>
              <input value={coForm.description} onChange={e=>setCoForm({...coForm,description:e.target.value})}
                placeholder="Describe the change (e.g. Add outlets in conference room)" required />
              <label>Amount ($)</label>
              <input type="number" value={coForm.amount} onChange={e=>setCoForm({...coForm,amount:e.target.value})}
                min="0" step="0.01" required />
              <button className="btn-success" type="submit">Send to Sub for Approval</button>
            </form>
          )}

          {!sc.changeOrders?.length ? (
            <p className="empty">No change orders yet.</p>
          ) : (
            <table>
              <thead><tr><th>Description</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {sc.changeOrders.map(co => (
                  <tr key={co.id}>
                    <td>{co.description}</td>
                    <td>{fmt(co.amount)}</td>
                    <td>
                      <span className={`badge ${co.status==='APPROVED'?'badge-green':co.status==='REJECTED'?'badge-red':'badge-yellow'}`}>
                        {co.status === 'PENDING_SUB' ? 'Awaiting Your Response' : co.status}
                      </span>
                    </td>
                    <td>
                      {!isGC && co.status === 'PENDING_SUB' && (
                        <>
                          <button className="btn-success btn-sm" onClick={() => respondCO(co.id, 'APPROVED')}>Approve</button>
                          <button className="btn-danger btn-sm" onClick={() => respondCO(co.id, 'REJECTED')}>Reject</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* INVOICES */}
        <div className="card">
          <div className="card-header">
            <h2>Invoices</h2>
          </div>

          {!isGC && (
            <form onSubmit={submitInvoice} style={{background:'#f0fdf4',padding:18,borderRadius:8,marginBottom:18}}>
              <div className="form-row">
                <div className="grow">
                  <label>Submit New Invoice ($)</label>
                  <input type="number" value={invoiceAmount} onChange={e=>setInvoiceAmount(e.target.value)}
                    min="0.01" step="0.01" placeholder="Enter invoice amount" required style={{marginBottom:0}} />
                </div>
                <button className="btn-primary" type="submit">Submit Invoice</button>
              </div>
            </form>
          )}

          {!sc.invoices?.length ? (
            <p className="empty">No invoices yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Amount</th><th>Status</th><th>Over Amount</th><th>Override Note</th>
                  {isGC && <th>GC Action</th>}
                </tr>
              </thead>
              <tbody>
                {sc.invoices.map(inv => (
                  <tr key={inv.id} className={inv.status==='PENDING'&&inv.flaggedOverAmount>0 ? 'flag-row' : ''}>
                    <td style={{color:'#64748b',fontSize:13}}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td><strong>{fmt(inv.amount)}</strong></td>
                    <td>
                      <span className={`badge ${inv.status==='APPROVED'?'badge-green':inv.status==='REJECTED'?'badge-red':'badge-yellow'}`}>
                        {inv.status}{inv.status==='PENDING'&&inv.flaggedOverAmount>0 ? ' ⚠' : ''}
                      </span>
                    </td>
                    <td style={{color:inv.flaggedOverAmount>0?'#dc2626':undefined,fontWeight:inv.flaggedOverAmount>0?700:400}}>
                      {inv.flaggedOverAmount > 0 ? fmt(inv.flaggedOverAmount) : '—'}
                    </td>
                    <td style={{fontSize:13,color:'#64748b',maxWidth:200}}>{inv.overrideReason || '—'}</td>
                    {isGC && (
                      <td>
                        {inv.status === 'PENDING' && inv.flaggedOverAmount > 0 && (
                          <div className="override-block">
                            <input
                              placeholder="Enter reason to override and approve..."
                              value={overrideReasons[inv.id]||''}
                              onChange={e => setOverrideReasons({...overrideReasons, [inv.id]: e.target.value})}
                            />
                            <div className="override-actions">
                              <button className="btn-warning btn-sm" onClick={() => invoiceAction(inv.id,'OVERRIDE')}>Override &amp; Approve</button>
                              <button className="btn-danger btn-sm" onClick={() => invoiceAction(inv.id,'REJECT')}>Reject</button>
                            </div>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
""")

# ── API: AUTH ─────────────────────────────────────────────────
write('pages/api/auth/signup.js', """import prisma from '@/lib/db'
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password, role, companyName } = req.body
  if (!email||!password||!role||!companyName) return res.status(400).json({error:'All fields required'})
  if (!['GC','SUB'].includes(role)) return res.status(400).json({error:'Role must be GC or SUB'})
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(400).json({error:'Email already in use'})
  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({ data: { email, passwordHash, role, companyName } })
  setAuthCookie(res, generateToken(user))
  return res.status(201).json({ id:user.id, email:user.email, role:user.role, companyName:user.companyName })
}
""")

write('pages/api/auth/login.js', """import prisma from '@/lib/db'
import { comparePassword, generateToken, setAuthCookie } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({error:'Invalid email or password'})
  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) return res.status(401).json({error:'Invalid email or password'})
  setAuthCookie(res, generateToken(user))
  return res.json({ id:user.id, email:user.email, role:user.role, companyName:user.companyName })
}
""")

write('pages/api/auth/me.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id:true, email:true, role:true, companyName:true },
  })
  return res.json(user)
}
""")

write('pages/api/auth/logout.js', """import { clearAuthCookie } from '@/lib/auth'

export default async function handler(req, res) {
  clearAuthCookie(res)
  return res.json({ ok: true })
}
""")

# ── API: PROJECTS ─────────────────────────────────────────────
write('pages/api/projects.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})

  if (req.method === 'GET') {
    if (auth.role === 'GC') {
      const projects = await prisma.project.findMany({ where:{gcId:auth.id}, orderBy:{createdAt:'desc'} })
      return res.json(projects)
    } else {
      const memberships = await prisma.projectMember.findMany({
        where: { userId: auth.id, roleOnProject: 'SUB' },
        include: { project: true },
      })
      return res.json(memberships.map(m => m.project))
    }
  }

  if (req.method === 'POST') {
    if (auth.role !== 'GC') return res.status(403).json({error:'Only GCs can create projects'})
    const { name } = req.body
    if (!name) return res.status(400).json({error:'Name required'})
    const project = await prisma.project.create({
      data: { name, gcId: auth.id, status:'BIDDING', members:{ create:{ userId:auth.id, roleOnProject:'GC' } } },
    })
    return res.status(201).json(project)
  }

  return res.status(405).end()
}
""")

# ── API: PROJECT/[ID] ─────────────────────────────────────────
write('pages/api/project/[id]/index.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { getScoreboard } from '@/lib/scoreboard'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const { id } = req.query

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: { include:{ user:{ select:{id:true,companyName:true,email:true} } } },
      bids: { include:{ sub:{select:{id:true,companyName:true,email:true}} }, orderBy:{createdAt:'desc'} },
      subcontracts: { include:{ sub:{select:{id:true,companyName:true,email:true}} } },
    },
  })

  if (!project) return res.status(404).json({error:'Not found'})
  const isMember = project.members.some(m => m.userId === auth.id)
  if (!isMember) return res.status(403).json({error:'Access denied'})

  if (req.method === 'GET') {
    const subcontractsWithData = await Promise.all(
      project.subcontracts.map(async sc => {
        const scoreboard = await getScoreboard(sc.id)
        const flagged = await prisma.invoice.count({
          where:{ subcontractId:sc.id, status:'PENDING', flaggedOverAmount:{gt:0} }
        })
        return { ...sc, scoreboard, hasFlaggedInvoices: flagged > 0 }
      })
    )
    const result = { ...project, subcontracts: subcontractsWithData }
    if (auth.role === 'SUB') {
      result.bids = project.bids.filter(b => b.subId === auth.id)
      result.subcontracts = subcontractsWithData.filter(s => s.subId === auth.id)
    }
    return res.json(result)
  }

  if (req.method === 'PATCH') {
    if (project.gcId !== auth.id) return res.status(403).json({error:'Only GC can update project'})
    const { status } = req.body
    if (!['BIDDING','CONSTRUCTION','COMPLETE'].includes(status))
      return res.status(400).json({error:'Invalid status'})
    const updated = await prisma.project.update({ where:{id}, data:{status} })
    return res.json(updated)
  }

  return res.status(405).end()
}
""")

write('pages/api/project/[id]/invite.js', """import prisma from '@/lib/db'
import { getAuthUser, hashPassword } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = getAuthUser(req)
  if (!auth || auth.role !== 'GC') return res.status(403).json({error:'GC only'})

  const { id: projectId } = req.query
  const { email, companyName } = req.body
  if (!email) return res.status(400).json({error:'Email required'})

  const project = await prisma.project.findUnique({ where:{ id:projectId } })
  if (!project || project.gcId !== auth.id) return res.status(403).json({error:'Access denied'})

  let subUser = await prisma.user.findUnique({ where:{ email } })
  let tempPassword = null

  if (!subUser) {
    tempPassword = Math.random().toString(36).slice(2,10)
    const passwordHash = await hashPassword(tempPassword)
    subUser = await prisma.user.create({
      data:{ email, passwordHash, role:'SUB', companyName: companyName || email }
    })
  } else if (subUser.role !== 'SUB') {
    return res.status(400).json({error:'That email belongs to a GC account'})
  }

  const existing = await prisma.projectMember.findFirst({ where:{ projectId, userId:subUser.id } })
  if (existing) return res.status(400).json({error:'Sub is already on this project'})

  await prisma.projectMember.create({ data:{ projectId, userId:subUser.id, roleOnProject:'SUB' } })

  return res.status(201).json({
    user: { id:subUser.id, email:subUser.email, companyName:subUser.companyName },
    tempPassword,
    isNew: !!tempPassword,
  })
}
""")

write('pages/api/project/[id]/bids.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const { id: projectId } = req.query

  if (req.method === 'POST') {
    if (auth.role !== 'SUB') return res.status(403).json({error:'Only subs can submit bids'})
    const { amount } = req.body
    if (!amount || isNaN(amount)) return res.status(400).json({error:'Valid amount required'})

    const member = await prisma.projectMember.findFirst({ where:{ projectId, userId:auth.id, roleOnProject:'SUB' } })
    if (!member) return res.status(403).json({error:'You are not a member of this project'})

    const existing = await prisma.bid.findFirst({ where:{ projectId, subId:auth.id, status:{in:['PENDING','ACCEPTED']} } })
    if (existing) return res.status(400).json({error:'You already have a bid on this project'})

    const bid = await prisma.bid.create({ data:{ projectId, subId:auth.id, amount:parseFloat(amount), status:'PENDING' } })
    return res.status(201).json(bid)
  }

  return res.status(405).end()
}
""")

# ── API: BID ACCEPT ───────────────────────────────────────────
write('pages/api/bid/[id]/accept.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = getAuthUser(req)
  if (!auth || auth.role !== 'GC') return res.status(403).json({error:'GC only'})
  const { id } = req.query

  const bid = await prisma.bid.findUnique({ where:{id}, include:{project:true} })
  if (!bid) return res.status(404).json({error:'Bid not found'})
  if (bid.project.gcId !== auth.id) return res.status(403).json({error:'Access denied'})
  if (bid.status !== 'PENDING') return res.status(400).json({error:'Bid is not pending'})

  const [updatedBid, subcontract] = await prisma.$transaction([
    prisma.bid.update({ where:{id}, data:{status:'ACCEPTED'} }),
    prisma.subcontract.create({ data:{ projectId:bid.projectId, subId:bid.subId, baseContractAmount:bid.amount } }),
  ])

  return res.status(201).json({ bid: updatedBid, subcontract })
}
""")

# ── API: SUBCONTRACT ──────────────────────────────────────────
write('pages/api/subcontract/[id]/index.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { getScoreboard } from '@/lib/scoreboard'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const { id } = req.query

  const sc = await prisma.subcontract.findUnique({
    where:{id},
    include:{
      project: true,
      sub: { select:{id:true,companyName:true,email:true} },
      changeOrders: { orderBy:{createdAt:'desc'} },
      invoices: { orderBy:{createdAt:'desc'} },
    },
  })
  if (!sc) return res.status(404).json({error:'Not found'})

  const isSub = auth.role === 'SUB' && sc.subId === auth.id
  const isGC = auth.role === 'GC' && sc.project.gcId === auth.id
  if (!isSub && !isGC) return res.status(403).json({error:'Access denied'})

  const scoreboard = await getScoreboard(id)
  return res.json({ ...sc, scoreboard })
}
""")

write('pages/api/subcontract/[id]/change-orders.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const { id: subcontractId } = req.query

  const sc = await prisma.subcontract.findUnique({ where:{id:subcontractId}, include:{project:true} })
  if (!sc) return res.status(404).json({error:'Not found'})

  const isGC = auth.role === 'GC' && sc.project.gcId === auth.id
  const isSub = auth.role === 'SUB' && sc.subId === auth.id
  if (!isGC && !isSub) return res.status(403).json({error:'Access denied'})

  if (req.method === 'POST') {
    if (!isGC) return res.status(403).json({error:'Only GC can create change orders'})
    const { description, amount } = req.body
    if (!description || !amount || isNaN(amount)) return res.status(400).json({error:'Description and amount required'})
    const co = await prisma.changeOrder.create({
      data:{ subcontractId, description, amount:parseFloat(amount), status:'PENDING_SUB' }
    })
    return res.status(201).json(co)
  }

  return res.status(405).end()
}
""")

write('pages/api/subcontract/[id]/invoices.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  const auth = getAuthUser(req)
  if (!auth) return res.status(401).json({error:'Not authenticated'})
  const { id: subcontractId } = req.query

  const sc = await prisma.subcontract.findUnique({
    where:{id:subcontractId},
    include:{ project:true, changeOrders:true, invoices:true },
  })
  if (!sc) return res.status(404).json({error:'Not found'})

  const isSub = auth.role === 'SUB' && sc.subId === auth.id
  const isGC = auth.role === 'GC' && sc.project.gcId === auth.id
  if (!isSub && !isGC) return res.status(403).json({error:'Access denied'})

  if (req.method === 'POST') {
    if (!isSub) return res.status(403).json({error:'Only sub can submit invoices'})
    const { amount } = req.body
    if (!amount || isNaN(amount)) return res.status(400).json({error:'Valid amount required'})

    const A = parseFloat(amount)
    const base = sc.baseContractAmount
    const coTotal = sc.changeOrders.filter(c=>c.status==='APPROVED').reduce((s,c)=>s+c.amount,0)
    const currentApprovedTotal = base + coTotal
    const invoicedTotal = sc.invoices.filter(i=>i.status==='APPROVED').reduce((s,i)=>s+i.amount,0)
    const projectedTotal = invoicedTotal + A

    const status = projectedTotal <= currentApprovedTotal ? 'APPROVED' : 'PENDING'
    const flaggedOverAmount = status === 'PENDING' ? projectedTotal - currentApprovedTotal : 0

    const invoice = await prisma.invoice.create({ data:{ subcontractId, amount:A, status, flaggedOverAmount } })
    return res.status(201).json(invoice)
  }

  return res.status(405).end()
}
""")

# ── API: CHANGE ORDER RESPOND ─────────────────────────────────
write('pages/api/change-order/[id]/respond.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = getAuthUser(req)
  if (!auth || auth.role !== 'SUB') return res.status(403).json({error:'Subs only'})
  const { id } = req.query
  const { action } = req.body

  if (!['APPROVED','REJECTED'].includes(action)) return res.status(400).json({error:'Action must be APPROVED or REJECTED'})

  const co = await prisma.changeOrder.findUnique({ where:{id}, include:{subcontract:true} })
  if (!co) return res.status(404).json({error:'Not found'})
  if (co.subcontract.subId !== auth.id) return res.status(403).json({error:'Access denied'})
  if (co.status !== 'PENDING_SUB') return res.status(400).json({error:'Change order is not pending your response'})

  const updated = await prisma.changeOrder.update({ where:{id}, data:{status:action} })
  return res.json(updated)
}
""")

# ── API: INVOICE ACTION ───────────────────────────────────────
write('pages/api/invoice/[id]/action.js', """import prisma from '@/lib/db'
import { getAuthUser } from '@/lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = getAuthUser(req)
  if (!auth || auth.role !== 'GC') return res.status(403).json({error:'GC only'})
  const { id } = req.query
  const { action, overrideReason } = req.body

  const invoice = await prisma.invoice.findUnique({
    where:{id}, include:{ subcontract:{ include:{ project:true } } }
  })
  if (!invoice) return res.status(404).json({error:'Not found'})
  if (invoice.subcontract.project.gcId !== auth.id) return res.status(403).json({error:'Access denied'})
  if (invoice.status !== 'PENDING') return res.status(400).json({error:'Invoice is not pending'})

  if (action === 'REJECT') {
    const updated = await prisma.invoice.update({ where:{id}, data:{status:'REJECTED'} })
    return res.json(updated)
  }

  if (action === 'OVERRIDE') {
    if (!overrideReason || !overrideReason.trim()) return res.status(400).json({error:'Override reason is required'})
    const updated = await prisma.invoice.update({
      where:{id}, data:{ status:'APPROVED', overrideReason: overrideReason.trim() }
    })
    return res.json(updated)
  }

  return res.status(400).json({error:'Action must be REJECT or OVERRIDE'})
}
""")

print("\n✅ All files created successfully!\n")
print("=" * 50)
print("NEXT STEPS — run these commands:")
print("=" * 50)
print("  1.  npm install")
print("  2.  npm run db:setup")
print("  3.  npm run dev")
print("")
print("Then click the browser preview link at the top of Replit.")
print("Sign up as a GC first, then open a new browser tab to sign up as a Sub.")
print("=" * 50)
