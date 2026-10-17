import type { ReactNode } from "react";
import { FintechShell } from "../FintechShell.js";

export default function Layout({ children }: { children: ReactNode }) {
  return <FintechShell>{children}</FintechShell>;
}
