import type { App } from "antd";

type MessageApi = ReturnType<typeof App.useApp>["message"];
type ModalApi = ReturnType<typeof App.useApp>["modal"];
type NotificationApi = ReturnType<typeof App.useApp>["notification"];

let messageApi: MessageApi | undefined;
let modalApi: ModalApi | undefined;
let notificationApi: NotificationApi | undefined;

export function bindFeedback(apis: {
  message: MessageApi;
  modal: ModalApi;
  notification: NotificationApi;
}) {
  messageApi = apis.message;
  modalApi = apis.modal;
  notificationApi = apis.notification;
}

export const feedback = {
  message: () => messageApi,
  modal: () => modalApi,
  notification: () => notificationApi
};
