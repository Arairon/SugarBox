import { Activity } from "react";
import { useSugarBoxState } from "../lib/state";
import { pages } from "../pages/pagesIndex";

export function Content() {
  const { page: currentPage } = useSugarBoxState();
  return (
    <main className='flex flex-1 flex-col items-center justify-center'>
      {
        Object.entries(pages).map(([page, content]) => {
          return <Activity mode={currentPage === page ? "visible" : "hidden"}>{content()}</Activity>
        })
      }
    </main>
  );
}

