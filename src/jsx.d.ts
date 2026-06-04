import type { JSX as ReactJSX } from "react";

declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
    type ElementClass = ReactJSX.ElementClass;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute;
    type LibraryManagedAttributes<C, P> = ReactJSX.LibraryManagedAttributes<C, P>;
    interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
  }
}

// Vendor-prefixed CSS mask properties missing from React's CSSProperties.
type MaskModeValue = "alpha" | "luminance" | "match-source" | "match-source-or-alpha";

declare module "react" {
  interface CSSProperties {
    WebkitMaskImage?: string;
    WebkitMaskMode?: MaskModeValue;
  }
}
