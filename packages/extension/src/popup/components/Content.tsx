import { Activity, Fragment } from "react";
import { useSugarBoxState } from "../lib/state";
import { nonActivityPages, pages } from "../pages/pagesIndex";

export function Content() {
  const { page: currentPage } = useSugarBoxState();
  return (
    <>
      {
        Object.entries(pages).map(([pageName, Page]) => {
          return (
            <Activity mode={currentPage === pageName ? "visible" : "hidden"} key={pageName}>
              <Page />
            </Activity>
          )
        })
      }
      {
        Object.entries(nonActivityPages).map(([pageName, Page]) => {
          return (
            <Fragment key={pageName + "-fragment"}>{currentPage === pageName && <Page key={pageName}/>}</Fragment>
          )
        })
      }
    </>
  );
}

