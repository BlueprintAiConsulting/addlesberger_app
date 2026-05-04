import { useState, useEffect } from 'react'
import { doc, onSnapshot, orderBy } from 'firebase/firestore'
import { Building2, Users, LogOut, User } from 'lucide-react'
import { db, COMPANY_ID } from '@/firebase'
import { useAuth } from '@/hooks/useAuth'
import { useCollection } from '@/hooks/useCollection'
import { updateItem } from '@/lib/firestore'
import { Modal } from '@/components/Modal'
import type { Company, Member } from '@/types'

export function Settings() {
  const { user, logout } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')

  const { data: members } = useCollection<Member>('members', [])

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'companies', COMPANY_ID), (snap) => {
      if (snap.exists()) {
        setCompany({ id: snap.id, ...snap.data() } as Company)
      }
    })
    return unsubscribe
  }, [])

  const openEdit = () => {
    if (!company) return
    setCompanyName(company.name || '')
    setCompanyPhone(company.phone || '')
    setCompanyEmail(company.email || '')
    setEditOpen(true)
  }

  const handleSave = async () => {
    // Update company doc directly
    const { updateDoc, serverTimestamp } = await import('firebase/firestore')
    await updateDoc(doc(db, 'companies', COMPANY_ID), {
      name: companyName,
      phone: companyPhone,
      email: companyEmail,
      updatedAt: serverTimestamp(),
    })
    setEditOpen(false)
  }

  return (
    <div className="stack stack-lg">
      <h1 className="page-title">Settings</h1>

      {/* Company info */}
      <div className="card">
        <div className="row row-between" style={{ marginBottom: 16 }}>
          <div className="row gap-sm">
            <Building2 size={20} style={{ color: 'var(--brand)' }} />
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Company</h2>
          </div>
          <button className="btn btn-outline btn-sm" onClick={openEdit}>Edit</button>
        </div>
        {company ? (
          <div className="stack stack-sm">
            <div><span className="text-sm text-muted">Name</span><p style={{ margin: '2px 0 0', fontWeight: 600 }}>{company.name || 'Not set'}</p></div>
            <div><span className="text-sm text-muted">Phone</span><p style={{ margin: '2px 0 0' }}>{company.phone || 'Not set'}</p></div>
            <div><span className="text-sm text-muted">Email</span><p style={{ margin: '2px 0 0' }}>{company.email || 'Not set'}</p></div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Company info will appear here once set up.</p>
        )}
      </div>

      {/* Members */}
      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 16 }}>
          <Users size={20} style={{ color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Team Members</h2>
        </div>
        {members.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>No members yet.</p>
        ) : (
          <div className="stack stack-sm">
            {members.map(m => (
              <div key={m.id} className="row gap-sm" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  fontSize: 14, fontWeight: 700, flexShrink: 0,
                }}>
                  {(m.displayName || m.email)[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{m.displayName || 'Unknown'}</p>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{m.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current user */}
      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 16 }}>
          <User size={20} style={{ color: 'var(--brand)' }} />
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Your Account</h2>
        </div>
        <div className="stack stack-sm">
          <div><span className="text-sm text-muted">Name</span><p style={{ margin: '2px 0 0', fontWeight: 600 }}>{user?.displayName || 'Not set'}</p></div>
          <div><span className="text-sm text-muted">Email</span><p style={{ margin: '2px 0 0' }}>{user?.email}</p></div>
        </div>
        <button className="btn btn-outline btn-full" style={{ marginTop: 20 }} onClick={logout}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      {/* Edit company modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Company">
        <div className="stack stack-md">
          <div><label className="label">Company Name</label><input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your Roofing Co." /></div>
          <div><label className="label">Phone</label><input className="input" type="tel" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} placeholder="555-0123" /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} placeholder="info@company.com" /></div>
          <button className="btn btn-primary btn-full" onClick={handleSave}>Save</button>
        </div>
      </Modal>
    </div>
  )
}
