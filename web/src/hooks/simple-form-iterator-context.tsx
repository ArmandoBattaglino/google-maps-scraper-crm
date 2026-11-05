/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext } from "react";

export const SimpleFormIteratorContext = createContext<
  SimpleFormIteratorContextValue | undefined
>(undefined);

export type SimpleFormIteratorContextValue = {
  add: (item?: any) => void;
  remove: (index: number) => void;
  reOrder: (index: number, newIndex: number) => void;
  source: string;
  total: number;
};

export const useSimpleFormIterator = () => {
  const context = useContext(SimpleFormIteratorContext);
  if (!context) {
    throw new Error(
      "useSimpleFormIterator must be used inside a SimpleFormIterator",
    );
  }
  return context;
};

export const SimpleFormIteratorItemContext = createContext<
  SimpleFormIteratorItemContextValue | undefined
>(undefined);

export type SimpleFormIteratorItemContextValue = {
  index: number;
  total: number;
  remove: () => void;
  reOrder: (newIndex: number) => void;
};

export const useSimpleFormIteratorItem = () => {
  const context = useContext(SimpleFormIteratorItemContext);
  if (!context) {
    throw new Error(
      "useSimpleFormIteratorItem must be used inside a SimpleFormIteratorItem",
    );
  }
  return context;
};
