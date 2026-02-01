import { Activity } from "react";
import { useSugarBoxState } from "../lib/state";
import { pages } from "../pages/pagesIndex";

export function Content() {
  const { page: currentPage } = useSugarBoxState();
  return (
    <>
      {
        Object.entries(pages).map(([pageName, Page]) => {
          return (
            <Activity mode={currentPage === pageName ? "visible" : "hidden"} key={pageName}>
              <Page/>
            </Activity>
          )
        })
      }
    </>
  );
}

