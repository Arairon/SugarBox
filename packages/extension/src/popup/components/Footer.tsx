import { Button } from "@/shared/components/ui/button";
import { useSugarBoxState } from "../lib/state";
import { pages } from "../pages/pagesIndex";

export function Footer() {
  const {setPage} = useSugarBoxState()

  return (
    <footer className='flex h-10 flex-row border-t-3 border-double border-header-border bg-header px-2'>
      {Object.keys(pages).map(page=><Button key={page} onClick={()=>setPage(page as keyof typeof pages)}>{page}</Button>)}
      
    </footer>
  );
}

