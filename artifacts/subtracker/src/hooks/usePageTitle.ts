import * as React from "react";

export function usePageTitle(title: string) {
  React.useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — SubTracker` : "SubTracker";
    return () => { document.title = prev; };
  }, [title]);
}
