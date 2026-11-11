/**
 * AI-new-skin · Client half
 *
 * 设置 → 「AI 壁纸」：挑一张 AI 娘壁纸，
 *   · 设为 Harness 背景（立刻生效，写 localStorage，下次启动自动恢复）
 *   · 设为 Windows 桌面壁纸（交给 Host 调 SystemParametersInfo）
 */
window.__ModuleLoader__.load({
  id: 'ai-new-skin',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const STORE_KEY = 'ai-new-skin.background'
    const STYLE_ID = 'ai-new-skin-theme'
    const API = '/ai-new-skin/api'

    const imgUrl = (id) =>
      '/ai-new-skin/img/' + String(id).split('/').map(encodeURIComponent).join('/')

    // ---------- Harness 背景 ----------
    function paint(styleText) {
      let el = document.getElementById(STYLE_ID)
      if (!styleText) {
        if (el) el.remove()
        return
      }
      if (!el) {
        el = document.createElement('style')
        el.id = STYLE_ID
        document.head.appendChild(el)
      }
      el.textContent = styleText
    }

    function cssFor(url) {
      return [
        `html { background-image: url("${url}") !important; background-size: cover !important; background-position: center center !important; background-attachment: fixed !important; background-repeat: no-repeat !important; }`,
        'body, body > div, #root, #app { background-color: transparent !important; }',
      ].join('\n')
    }

    function applyBackground(id) {
      if (!id) {
        paint('')
        try {
          localStorage.removeItem(STORE_KEY)
        } catch {}
        return
      }
      paint(cssFor(imgUrl(id)))
      try {
        localStorage.setItem(STORE_KEY, id)
      } catch {}
    }

    function savedBackground() {
      try {
        return localStorage.getItem(STORE_KEY) || ''
      } catch {
        return ''
      }
    }

    // ---------- 设置页 ----------
    function Panel() {
      const [items, setItems] = React.useState([])
      const [group, setGroup] = React.useState('all')
      const [selected, setSelected] = React.useState(savedBackground())
      const [status, setStatus] = React.useState('')
      const [busy, setBusy] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        fetch(`${API}/list`)
          .then((r) => r.json())
          .then((data) => {
            if (alive && data && Array.isArray(data.items)) setItems(data.items)
          })
          .catch((error) => alive && setStatus('读取壁纸清单失败：' + error.message))
        return () => {
          alive = false
        }
      }, [])

      const groups = React.useMemo(() => {
        const seen = []
        for (const it of items) if (!seen.includes(it.group)) seen.push(it.group)
        return seen
      }, [items])

      const shown = group === 'all' ? items : items.filter((it) => it.group === group)

      const onPickBackground = (id) => {
        applyBackground(id)
        setSelected(id)
        setStatus('已设为 Harness 背景：' + id)
      }

      const onClear = () => {
        applyBackground('')
        setSelected('')
        setStatus('已恢复默认背景')
      }

      const onDesktop = async () => {
        if (!selected) {
          setStatus('先选一张壁纸')
          return
        }
        setBusy(true)
        setStatus('正在设置桌面壁纸…')
        try {
          const res = await fetch(`${API}/desktop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selected }),
          })
          const data = await res.json()
          setStatus(data.ok ? '已设为 Windows 桌面壁纸：' + selected : '设置失败：' + data.error)
        } catch (error) {
          setStatus('设置失败：' + error.message)
        } finally {
          setBusy(false)
        }
      }

      const chip = (label, active, onClick) =>
        h(
          'button',
          {
            key: label,
            onClick,
            style: {
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid ' + (active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'),
              background: active ? 'var(--dsw-alias-brand-primary)' : 'transparent',
              color: active ? '#fff' : 'var(--dsw-alias-label-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            },
          },
          label,
        )

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 2px 20px' } },

        h('div', { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.7 } },
          '65 张 AI 娘壁纸。选中一张后，可以设为 Harness 背景（只改编辑器），也可以设为 Windows 桌面壁纸（改整台电脑）。'),

        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } },
          chip('全部', group === 'all', () => setGroup('all')),
          groups.map((g) => chip(g, group === g, () => setGroup(g))),
          h('span', { style: { marginLeft: 'auto', fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
            selected ? '当前：' + selected : '当前：默认背景')),

        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
            gap: 10,
            maxHeight: 430,
            overflowY: 'auto',
            padding: 4,
          },
        },
          shown.map((it) =>
            h(
              'button',
              {
                key: it.id,
                title: it.id,
                onClick: () => setSelected(it.id),
                onDoubleClick: () => onPickBackground(it.id),
                style: {
                  padding: 0,
                  border: '2px solid ' + (selected === it.id ? 'var(--dsw-alias-brand-primary)' : 'transparent'),
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--dsw-alias-bg-layer-1)',
                  cursor: 'pointer',
                  aspectRatio: '3 / 4',
                  position: 'relative',
                },
              },
              h('img', {
                src: imgUrl(it.id),
                alt: it.name,
                loading: 'lazy',
                decoding: 'async',
                style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
              }),
              h('span', {
                style: {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '3px 6px',
                  fontSize: 10,
                  color: '#fff',
                  background: 'linear-gradient(transparent, rgba(0,0,0,.55))',
                  textAlign: 'left',
                },
              }, it.name),
            ),
          )),

        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
          h('button', {
            onClick: () => selected && onPickBackground(selected),
            disabled: !selected,
            style: btnStyle(true),
          }, '设为 Harness 背景'),
          h('button', {
            onClick: onDesktop,
            disabled: busy || !selected,
            style: btnStyle(false),
          }, busy ? '设置中…' : '设为桌面壁纸'),
          h('button', { onClick: onClear, style: btnStyle(false) }, '恢复默认'),
          h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } }, status)),
      )
    }

    function btnStyle(primary) {
      return {
        padding: '7px 16px',
        borderRadius: 8,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
        color: primary ? '#fff' : 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        cursor: 'pointer',
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        applyBackground(savedBackground())

        const slots = ctx.get('slots')
        if (slots === undefined) return

        slots.inject('settings.section', () =>
          slots.register(
            { name: 'settings.section', id: 'ai-new-skin', order: 30, label: 'AI 壁纸' },
            () => h(Panel, null),
          ),
        )
      },
    }
  },
})
