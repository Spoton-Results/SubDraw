import * as React from "react";

export function usePageTitle(title: string) {
  React.useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — SubDraw` : "SubDraw";
    return () => { document.title = prev; };
  }, [title]);
}
