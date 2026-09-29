import { useMemo, useState } from 'react'
import { Avatar, Badge, Book3D, Cover, Empty, Field, Icon, Modal, PageHeader, Panel, readImage } from '../components/ui.jsx'
import { toast } from '../lib/bus.js'
import { notify, services, webAction, writeLog } from '../lib/services.js'
import { activeTxForCopy, categoryName, copyStatus, now, titleAvailability, useStore } from '../lib/store.js'
import { dueLabel, fmtDate, fmtShortDate, fmtShortDateTime } from '../lib/time.js'

const COVER_COLORS = ['#1f5f4b', '#27425a', '#7a3b2e', '#2d2f33', '#5b4a8a', '#8a5a12', '#1c4e80', '#5c1f24', '#1e5b6b', '#4f6d2f']
const MOTIFS = ['circuit', 'rings', 'grid', 'type', 'wave', 'curve', 'stripes']
const RFID_RE = /^[A-F0-9]{8,14}$/

function titleStatus(s, titleId) {
  const { total, available, copies } = titleAvailability(s, titleId)
  if (!total) return 'archived'
  if (available) return 'available'
  const statuses = copies.map((c) => copyStatus(s, c))
  if (statuses.includes('overdue')) return 'overdue'
  if (statuses.includes('borrowed')) return 'borrowed'
  if (statuses.includes('reserved')) return 'reserved'
  return statuses[0]
}

export default function Books({ go }) {
  const s = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [adding, setAdding] = useState(false)

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return s.titles.filter((t) => {
      if (t.archived !== showArchived) return false
      if (cat && t.category !== cat) return false
      if (status && titleStatus(s, t.id) !== status) return false
      if (!needle) return true
      const rfids = s.copies.filter((c) => c.titleId === t.id).map((c) => c.rfid.toLowerCase())
      return [t.title, t.author, t.isbn, t.publisher].some((v) => v.toLowerCase().includes(needle)) || rfids.some((r) => r.includes(needle))
    })
  }, [s, q, cat, status, showArchived])

  return (
    <div className="page">
      <PageHeader eyebrow="02 / Catalog" title="Books">
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add book</button>
      </PageHeader>
      <div className="filters">
        <label className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, author, ISBN or RFID" aria-label="Search books" /></label>
        <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {['available', 'borrowed', 'reserved', 'overdue', 'lost', 'maintenance'].map((st) => <option key={st} value={st}>{st[0].toUpperCase() + st.slice(1)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Archived</label>
      </div>
      {list.length === 0 ? <Empty title="No books match">Try a different search or filter.</Empty> : (
        <div className="book-grid">
          {list.map((t) => {
            const a = titleAvailability(s, t.id)
            return (
              <button type="button" key={t.id} className="book-card" onClick={() => go(`books/${t.id}`)}>
                <Cover title={t} />
                <div className="book-card-body">
                  <Badge status={titleStatus(s, t.id)} />
                  <strong>{t.title}</strong>
                  <span className="muted">{t.author}</span>
                  <span className="mono small">{a.available} of {a.total} available</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
      {adding && <BookForm onClose={() => setAdding(false)} onSaved={(id) => { setAdding(false); go(`books/${id}`) }} />}
    </div>
  )
}

export function BookForm({ title = null, onClose, onSaved }) {
  const s = useStore()
  const [form, setForm] = useState(() => title ? { ...title, shelf: '', rfid: '' } : {
    title: '', author: '', isbn: '', category: 'ce', publisher: '', year: new Date().getFullYear(), description: '', shelf: 'A1-01', rfid: '',
    cover: { color: COVER_COLORS[0], motif: 'circuit', image: null },
  })
  const [errors, setErrors] = useState({})
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setCover = (k, v) => setForm((f) => ({ ...f, cover: { ...f.cover, [k]: v } }))

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setErrors((x) => ({ ...x, cover: 'Choose an image file.' })); return }
    setCover('image', await readImage(file))
  }

  const save = (e) => {
    e.preventDefault()
    const err = {}
    if (!form.title.trim()) err.title = 'Title is required.'
    if (!form.author.trim()) err.author = 'Author is required.'
    if (!/^[0-9-]{10,17}X?$/.test(form.isbn.trim())) err.isbn = 'Enter a valid ISBN (digits and dashes).'
    const year = Number(form.year)
    if (!year || year < 1450 || year > new Date().getFullYear() + 1) err.year = 'Enter a valid year.'
    if (!title) {
      const rfid = form.rfid.trim().toUpperCase()
      if (!RFID_RE.test(rfid)) err.rfid = 'RFID UID must be 8–14 hex characters.'
      else if (s.copies.some((c) => c.rfid === rfid) || s.students.some((st) => st.rfid === rfid)) err.rfid = 'This RFID UID is already assigned.'
    }
    setErrors(err)
    if (Object.keys(err).length) return
    let id = title?.id
    webAction((st) => {
      const data = { title: form.title.trim(), author: form.author.trim(), isbn: form.isbn.trim(), category: form.category, publisher: form.publisher.trim(), year, description: form.description.trim(), cover: form.cover }
      if (title) {
        Object.assign(st.titles.find((x) => x.id === title.id), data)
        writeLog(st, { user: 'Librarian', action: 'Book edited', copyId: `${title.id}-c1`, result: data.title })
      } else {
        id = `t${Date.now().toString(36)}`
        st.titles.push({ id, ...data, addedAt: now(), archived: false })
        st.copies.push({ id: `${id}-c1`, titleId: id, copyNo: '001', rfid: form.rfid.trim().toUpperCase(), shelf: form.shelf.trim() || 'A1-01', status: 'available' })
        writeLog(st, { user: 'Librarian', action: 'Book created', copyId: `${id}-c1`, result: data.title })
        writeLog(st, { user: 'Librarian', action: 'RFID assigned', copyId: `${id}-c1`, result: form.rfid.trim().toUpperCase() })
      }
    })
    toast('good', title ? 'Book updated' : 'Book added', form.title)
    onSaved(id)
  }

  const preview = { ...form, title: form.title || 'Book title', author: form.author || 'Author' }
  return (
    <Modal title={title ? 'Edit book' : 'Add book'} onClose={onClose} wide footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="submit" form="book-form" className="btn btn-primary">Save book</button></>}>
      <form id="book-form" className="form-split" onSubmit={save} noValidate>
        <div className="cover-editor">
          <Book3D title={preview} size="lg" />
          <label className="btn btn-sm"><Icon name="upload" size={15} />Upload cover<input type="file" accept="image/*" hidden onChange={upload} /></label>
          {form.cover.image && <button type="button" className="link-btn" onClick={() => setCover('image', null)}>Remove image</button>}
          {errors.cover && <p className="error-text">{errors.cover}</p>}
          {!form.cover.image && (
            <>
              <div className="swatches">{COVER_COLORS.map((c) => <button key={c} type="button" className={form.cover.color === c ? 'on' : ''} style={{ background: c }} onClick={() => setCover('color', c)} aria-label={`Cover colour ${c}`} />)}</div>
              <select value={form.cover.motif} onChange={(e) => setCover('motif', e.target.value)} aria-label="Cover motif">{MOTIFS.map((m) => <option key={m}>{m}</option>)}</select>
            </>
          )}
        </div>
        <div className="form-grid">
          <Field label="Title"><input value={form.title} onChange={(e) => set('title', e.target.value)} />{errors.title && <span className="error-text">{errors.title}</span>}</Field>
          <Field label="Author"><input value={form.author} onChange={(e) => set('author', e.target.value)} />{errors.author && <span className="error-text">{errors.author}</span>}</Field>
          <Field label="ISBN"><input value={form.isbn} onChange={(e) => set('isbn', e.target.value)} placeholder="978-0-13-212695-3" />{errors.isbn && <span className="error-text">{errors.isbn}</span>}</Field>
          <Field label="Category"><select value={form.category} onChange={(e) => set('category', e.target.value)}>{s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Publisher"><input value={form.publisher} onChange={(e) => set('publisher', e.target.value)} /></Field>
          <Field label="Publication year"><input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />{errors.year && <span className="error-text">{errors.year}</span>}</Field>
          {!title && <Field label="Shelf / location"><input value={form.shelf} onChange={(e) => set('shelf', e.target.value)} /></Field>}
          {!title && <Field label="RFID tag UID (copy #001)" hint="Scan the tag or type its UID."><input value={form.rfid} onChange={(e) => set('rfid', e.target.value.toUpperCase())} className="mono" placeholder="A8301C07" />{errors.rfid && <span className="error-text">{errors.rfid}</span>}</Field>}
          <Field label="Description"><textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
      </form>
    </Modal>
  )
}

function CopyModal({ titleId, copy, onClose }) {
  const s = useStore()
  const [rfid, setRfid] = useState(copy?.rfid ?? '')
  const [shelf, setShelf] = useState(copy?.shelf ?? 'A1-01')
  const [error, setError] = useState('')
  const save = (e) => {
    e.preventDefault()
    const uid = rfid.trim().toUpperCase()
    if (!RFID_RE.test(uid)) { setError('RFID UID must be 8–14 hex characters.'); return }
    if (s.copies.some((c) => c.rfid === uid && c.id !== copy?.id) || s.students.some((st) => st.rfid === uid)) { setError('This RFID UID is already assigned.'); return }
    webAction((st) => {
      if (copy) {
        const c = st.copies.find((x) => x.id === copy.id)
        c.rfid = uid
        c.shelf = shelf
        writeLog(st, { user: 'Librarian', action: 'RFID assigned', copyId: c.id, result: uid })
      } else {
        const existing = st.copies.filter((x) => x.titleId === titleId)
        const no = String(existing.length + 1).padStart(3, '0')
        const id = `${titleId}-c${existing.length + 1}-${Date.now().toString(36).slice(-3)}`
        st.copies.push({ id, titleId, copyNo: no, rfid: uid, shelf, status: 'available' })
        writeLog(st, { user: 'Librarian', action: 'Book copy added', copyId: id, result: `Copy #${no}` })
        writeLog(st, { user: 'Librarian', action: 'RFID assigned', copyId: id, result: uid })
      }
    })
    toast('good', copy ? 'RFID tag updated' : 'Copy added', uid)
    onClose()
  }
  return (
    <Modal title={copy ? `Assign RFID · copy #${copy.copyNo}` : 'Add a physical copy'} onClose={onClose} footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button type="submit" form="copy-form" className="btn btn-primary">Save</button></>}>
      <form id="copy-form" className="form-grid" onSubmit={save}>
        <Field label="RFID tag UID" hint="Each physical copy has its own tag, even when copies share an ISBN."><input className="mono" value={rfid} onChange={(e) => { setRfid(e.target.value.toUpperCase()); setError('') }} autoFocus /></Field>
        <Field label="Shelf / location"><input value={shelf} onChange={(e) => setShelf(e.target.value)} /></Field>
        {error && <p className="error-text">{error}</p>}
      </form>
    </Modal>
  )
}

export function BookDetail({ id, go }) {
  const s = useStore()
  const [editing, setEditing] = useState(false)
  const [copyModal, setCopyModal] = useState(null)
  const title = s.titles.find((t) => t.id === id)
  if (!title) return <div className="page"><Empty title="Book not found"><button type="button" className="link-btn" onClick={() => go('books')}>Back to books</button></Empty></div>

  const t = now()
  const copies = s.copies.filter((c) => c.titleId === id)
  const copyIds = new Set(copies.map((c) => c.id))
  const history = s.transactions.filter((tx) => copyIds.has(tx.copyId)).sort((a, b) => b.borrowedAt - a.borrowedAt)
  const status = titleStatus(s, id)
  const everBorrowed = history.length > 0

  const setCopyStatus = (copyId, next) => {
    webAction((st) => {
      st.copies.find((c) => c.id === copyId).status = next
      writeLog(st, { user: 'Librarian', action: `Copy marked ${next}`, copyId, result: 'Success' })
      if (next === 'lost') notify(st, { audience: 'librarian', kind: 'lost', tone: 'warn', silent: true, title: 'Book marked lost', body: `${title.title} (${st.copies.find((c) => c.id === copyId).rfid})` })
    })
    toast('info', `Copy marked ${next}`)
  }
  const manualReturn = (copyId) => {
    const r = webAction((st) => services.returnBook(st, { copyId, device: 'Web', user: 'Librarian' }))
    toast(r.status === 200 ? 'good' : 'danger', r.status === 200 ? 'Return processed manually' : 'Return failed', r.status === 200 ? title.title : r.body.error)
  }
  const archive = () => {
    webAction((st) => {
      const x = st.titles.find((tt) => tt.id === id)
      x.archived = !x.archived
      writeLog(st, { user: 'Librarian', action: x.archived ? 'Book archived' : 'Book restored', copyId: copies[0]?.id, result: title.title })
    })
    toast('info', title.archived ? 'Book restored' : 'Book archived', title.title)
  }
  const remove = () => {
    if (!confirm(`Delete "${title.title}"? This cannot be undone.`)) return
    webAction((st) => {
      st.titles = st.titles.filter((tt) => tt.id !== id)
      st.copies = st.copies.filter((c) => c.titleId !== id)
      writeLog(st, { user: 'Librarian', action: 'Book deleted', result: title.title })
    })
    toast('info', 'Book deleted', title.title)
    go('books')
  }

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={() => go('books')}><Icon name="chevron" size={14} className="flip" />All books</button>
      <div className="book-hero">
        <Book3D title={title} size="xl" float />
        <div className="book-hero-body">
          <p className="eyebrow">{categoryName(s, title.category)} · Added {fmtDate(title.addedAt)}</p>
          <h1>{title.title}</h1>
          <p className="lead">{title.author}</p>
          <div className={`availability availability-${status}`}>
            <Badge status={status} />
            <strong>{status === 'available' ? `Available · ${titleAvailability(s, id).available} of ${copies.length} copies on the shelf` : status === 'archived' ? 'Archived' : 'Not available right now'}</strong>
          </div>
          <dl className="meta-grid">
            <div><dt>ISBN</dt><dd className="mono">{title.isbn}</dd></div>
            <div><dt>Publisher</dt><dd>{title.publisher}</dd></div>
            <div><dt>Year</dt><dd>{title.year}</dd></div>
            <div><dt>Copies</dt><dd>{copies.length}</dd></div>
          </dl>
          <p>{title.description}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setEditing(true)}><Icon name="edit" />Edit</button>
            <button type="button" className="btn" onClick={() => setCopyModal({})}><Icon name="plus" />Add copy</button>
            <button type="button" className="btn btn-ghost" onClick={archive}><Icon name="archive" />{title.archived ? 'Restore' : 'Archive'}</button>
            {!everBorrowed && <button type="button" className="btn btn-ghost btn-danger-text" onClick={remove}><Icon name="trash" />Delete</button>}
          </div>
          {everBorrowed && <p className="muted small">Books with borrowing history are archived instead of deleted, to keep the audit trail.</p>}
        </div>
      </div>

      <Panel title="Physical copies" sub="Each copy carries its own RFID tag, so the gate tracks the exact book." flush>
        <div className="copy-list">
          {copies.map((c) => {
            const tx = activeTxForCopy(s, c.id)
            const student = tx && s.students.find((st) => st.id === tx.studentId)
            const cs = copyStatus(s, c)
            const due = tx && dueLabel(tx.dueAt, t)
            return (
              <article key={c.id} className={`copy-row copy-${cs}`}>
                <div className="copy-id">
                  <span className="mono">#{c.copyNo}</span>
                  <Badge status={cs} />
                </div>
                <dl className="copy-meta">
                  <div><dt>RFID</dt><dd className="mono">{c.rfid}</dd></div>
                  <div><dt>Shelf</dt><dd>{c.shelf}</dd></div>
                </dl>
                {tx ? (
                  <div className="borrower">
                    <Avatar student={student} size={48} />
                    <div>
                      <strong>{student.name}</strong>
                      <span className="mono small">{student.studentId}</span>
                      <span className="small">Borrowed {fmtShortDateTime(tx.borrowedAt)} · Due {fmtShortDateTime(tx.dueAt)}</span>
                      <span className={`countdown countdown-${due.tone}`}>{due.text}</span>
                    </div>
                  </div>
                ) : <div className="borrower muted small">{cs === 'available' ? `On shelf ${c.shelf}` : cs === 'reserved' ? 'On the hold shelf' : '—'}</div>}
                <div className="copy-actions">
                  {tx && <button type="button" className="btn btn-sm" onClick={() => manualReturn(c.id)}><Icon name="return" size={15} />Manual return</button>}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCopyModal(c)}><Icon name="tag" size={15} />RFID</button>
                  {!tx && (
                    <select className="select-sm" value="" onChange={(e) => e.target.value && setCopyStatus(c.id, e.target.value)} aria-label="Change copy status">
                      <option value="">Set status…</option>
                      {['available', 'maintenance', 'lost'].filter((x) => x !== c.status).map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </Panel>

      <Panel title="Borrowing history" sub={`${history.length} loans across all copies`} flush>
        {history.length === 0 ? <Empty title="Never borrowed yet" /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Copy</th><th>Student</th><th>Borrowed</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead>
              <tbody>
                {history.map((tx) => {
                  const st = s.students.find((x) => x.id === tx.studentId)
                  const c = copies.find((x) => x.id === tx.copyId)
                  return (
                    <tr key={tx.id}>
                      <td className="mono">#{c.copyNo}</td>
                      <td>{st.name}<span className="sub">{st.studentId}</span></td>
                      <td>{fmtShortDate(tx.borrowedAt)}</td>
                      <td>{fmtShortDate(tx.dueAt)}</td>
                      <td>{tx.returnedAt ? fmtShortDate(tx.returnedAt) : '—'}</td>
                      <td>{tx.returnedAt ? <Badge status={tx.lateReturn ? 'overdue' : 'returned'}>{tx.lateReturn ? 'Returned late' : 'Returned'}</Badge> : <Badge status={t > tx.dueAt ? 'overdue' : 'borrowed'} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editing && <BookForm title={title} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {copyModal && <CopyModal titleId={id} copy={copyModal.id ? copyModal : null} onClose={() => setCopyModal(null)} />}
    </div>
  )
}
