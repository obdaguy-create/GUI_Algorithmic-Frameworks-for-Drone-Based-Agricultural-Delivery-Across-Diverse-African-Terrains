import { NavLink } from 'react-router-dom'

export default function Nav() {
  return (
    <nav className="nav">
      <a href="/" className="nav-brand">AGRO<span>FLY</span></a>
      <div className="nav-links">
        <NavLink to="/"         className={({isActive})=>"nav-link"+(isActive?" active":"")}>
          Farmer Portal
        </NavLink>
        <NavLink to="/operator" className={({isActive})=>"nav-link"+(isActive?" active":"")}>
          Operator Dispatch
        </NavLink>
      </div>
    </nav>
  )
}
