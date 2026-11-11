import { useState } from 'react'
import { DEMO } from '../lib/transport.js'
import { loadGame, loadIdentity, loadLastHost, newId } from '../lib/storage.js'
import { APP_NAME, Avatar, Seg } from './ui.jsx'

export default function Join({ initialCode, onJoin, onHost }) {
  const [code, setCode] = useState((initialCode || '').toUpperCase().slice(0, 5))
  const [name, setName] = useState('')
  const [role, setRole] = useState('player')
  const ready = code.length === 5 && name.trim().length > 0
  const previous = code.length === 5 ? loadIdentity(code) : null
  const lastHost = loadLastHost()
  const saved = lastHost ? loadGame(lastHost) : null
  const resumable = saved && saved.phase !== 'finished' ? lastHost : null

  const submit = (e) => {
    e.preventDefault()
    if (ready) onJoin({ code, name: name.trim().slice(0, 20), role, id: newId() })
  }

  return (
    <div className="join">
      <section className="join-intro">
        <div className="mascot" aria-hidden="true">
          <Avatar id={5} size={120} />
        </div>
        <h1 className="brand">{APP_NAME}</h1>
        <p className="join-lede">
          Биржевая игра о защите портфеля. Покупайте активы, следите за новостями и решайте, какой риск убрать с помощью
          форвардов, фьючерсов, опционов и свопов.
        </p>
        {DEMO && (
          <p className="demo-note">Демо-режим: подключиться можно только из вкладок этого браузера. Добавьте ключи Supabase, чтобы играть всей группой.</p>
        )}
      </section>

      <section className="join-card">
        <form onSubmit={submit}>
          <h2>Войти в игру</h2>
          <label>
            Код комнаты
            <input
              className="code-input"
              value={code}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck="false"
              placeholder="ABCDE"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            />
          </label>
          {previous && (
            <div className="rejoin">
              <button type="button" className="btn primary wide" onClick={() => onJoin({ code, ...previous })}>
                Вернуться как {previous.name}
              </button>
              <p className="muted small">Или войдите под новым именем ниже.</p>
            </div>
          )}
          <label>
            Ваше имя
            <input value={name} maxLength={20} placeholder="Имя или ник" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="field">
            <span className="field-label">Роль</span>
            <Seg
              label="Роль"
              value={role}
              onChange={setRole}
              options={[
                { value: 'player', label: 'Игрок' },
                { value: 'spectator', label: 'Зритель' },
              ]}
            />
            <p className="muted small">{role === 'player' ? 'Торгуете своим портфелем.' : 'Смотрите на рынок без торговли.'}</p>
          </div>
          <button type="submit" className="btn primary wide big" disabled={!ready}>
            Войти
          </button>
          <p className="muted small">Аватар выберете на следующем шаге.</p>
        </form>
        <div className="host-start">
          <p className="muted small">Вы ведущий?</p>
          <div className="host-buttons">
            <button type="button" className="btn ghost" onClick={() => onHost(null)}>
              Создать игру
            </button>
            {resumable && (
              <button type="button" className="btn ghost" onClick={() => onHost(resumable)}>
                Вернуться в комнату {resumable}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
