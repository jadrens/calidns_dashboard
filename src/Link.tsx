import { forwardRef, type ComponentPropsWithRef } from "react";
import { resolveDnsHref, useDnsLocation } from "./paths";

const Link = forwardRef<HTMLAnchorElement, ComponentPropsWithRef<"a">>(
  function Link({ href = "", ...props }, ref) {
    const { basePath } = useDnsLocation();
    return <a ref={ref} href={resolveDnsHref(href, basePath)} {...props} />;
  },
);

export default Link;
