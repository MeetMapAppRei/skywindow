import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Aperture, BookOpen, ClipboardList, Image, Moon, Star, User } from 'lucide-react'

const items = [
  { to: '/verdict', labelKey: 'nav.home', Icon: Star },
  { to: '/tonight', labelKey: 'nav.tonight', Icon: Moon },
  { to: '/sky-profiles', labelKey: 'nav.sky', Icon: Image },
  { to: '/planner', labelKey: 'nav.plan', Icon: ClipboardList },
  { to: '/equipment', labelKey: 'nav.equipment', Icon: Aperture },
  { to: '/sessions', labelKey: 'nav.log', Icon: BookOpen },
  { to: '/profile', labelKey: 'nav.profile', Icon: User },
]

export default function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="bottom-nav" aria-label={t('nav.primary')}>
      <ul className="bottom-nav__list">
        {items.map(({ to, labelKey, Icon }) => (
          <li key={to} className="bottom-nav__item">
            <NavLink
              to={to}
              viewTransition
              className={({ isActive }) =>
                `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="bottom-nav__icon"
                    aria-hidden
                    size={22}
                    strokeWidth={isActive ? 2.25 : 1.75}
                  />
                  {isActive ? <span className="bottom-nav__label">{t(labelKey)}</span> : null}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
