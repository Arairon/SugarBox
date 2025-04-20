import { NavLink } from "react-router";

function Test() {
  return (
    <>
      <h1>Test</h1>
      <NavLink to="/" end>test 1</NavLink>
      <NavLink to="/test" end>test 2</NavLink>
    </>
  )
}
export default Test;