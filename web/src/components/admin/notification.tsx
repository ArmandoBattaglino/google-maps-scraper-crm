import * as React from "react";
import { useCallback, useEffect } from "react";
import type { ToasterProps } from "sonner";
import { Toaster, toast } from "sonner";
import {
  CloseNotificationContext,
  useNotificationContext,
  useTakeUndoableMutation,
  useTranslate,
} from "ra-core";

export const Notification = (props: ToasterProps) => {
  const translate = useTranslate();
  const { notifications, takeNotification } = useNotificationContext();
  const takeMutation = useTakeUndoableMutation();

  useEffect(() => {
    if (notifications.length) {
      const notification = takeNotification();
      if (notification) {
        const { message, type = "info", notificationOptions } = notification;
        const { messageArgs, undoable, autoHideDuration } =
          notificationOptions || {};

        const beforeunload = (e: BeforeUnloadEvent) => {
          e.preventDefault();
          const confirmationMessage = "";
          e.returnValue = confirmationMessage;
          return confirmationMessage;
        };

        if (undoable) {
          window.addEventListener("beforeunload", beforeunload);
        }

        const mutation = takeMutation();

        const handleExited = () => {
          if (undoable) {
            if (mutation) {
              mutation({ isUndo: false });
            }
            window.removeEventListener("beforeunload", beforeunload);
          }
        };

        const handleUndo = () => {
          if (mutation) {
            mutation({ isUndo: true });
          }
          window.removeEventListener("beforeunload", beforeunload);
        };

        const finalMessage = message
          ? typeof message === "string"
            ? translate(message, messageArgs)
            : React.isValidElement(message)
              ? message
              : undefined
          : undefined;

        const duration =
          autoHideDuration === null ? Infinity : autoHideDuration;

        toast[type](finalMessage, {
          duration,
          action: undoable
            ? {
                label: translate("ra.action.undo"),
                onClick: handleUndo,
              }
            : undefined,
          onDismiss: handleExited,
          onAutoClose: handleExited,
        });
      }
    }
  }, [notifications, takeMutation, takeNotification, translate]);

  const handleRequestClose = useCallback(() => {
    toast.dismiss();
  }, []);

  return (
    <CloseNotificationContext.Provider value={handleRequestClose}>
      <Toaster
        richColors
        theme="light"
        closeButton
        position="bottom-center"
        {...props}
      />
    </CloseNotificationContext.Provider>
  );
};
