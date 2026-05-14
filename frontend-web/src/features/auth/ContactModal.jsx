import { CustomerServiceOutlined } from "@ant-design/icons";
import { App, Button, Form, Input, Modal, Result } from "antd";
import { useState } from "react";
import { contactApi } from "../../api/contact";
import { useLanguage } from "../../i18n.jsx";

export default function ContactModal({ open, onClose }) {
  const { t } = useLanguage();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleClose = () => {
    if (loading) return;
    onClose?.();
    // Reset state sau khi animation đóng modal kết thúc
    setTimeout(() => {
      form.resetFields();
      setDone(false);
    }, 250);
  };

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await contactApi.submit({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        company: values.company,
        fleetSize: values.fleetSize,
        message: values.message,
        // Honeypot — field rỗng. Bot tự fill sẽ bị backend silent-drop.
        hp: values.hp ?? ""
      });
      setDone(true);
    } catch (err) {
      message.error(err.message || "Gửi thất bại. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnClose
      maskClosable={!loading}
      width={560}
      title={
        <span>
          <CustomerServiceOutlined style={{ color: "#1677ff", marginRight: 8 }} />
          {t("contact.title")}
        </span>
      }
    >
      {done ? (
        <Result
          status="success"
          title={t("contact.success.title")}
          subTitle={t("contact.success.desc")}
          extra={<Button type="primary" onClick={handleClose}>{t("contact.cancel")}</Button>}
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={onSubmit}
          requiredMark={false}
          style={{ marginTop: 8 }}
        >
          <p style={{ color: "#64748b", marginTop: 0, marginBottom: 16 }}>
            {t("contact.subtitle")}
          </p>

          {/* Honeypot — ẩn khỏi user thật bằng CSS. Bot crawler sẽ fill và bị reject. */}
          <Form.Item name="hp" hidden>
            <Input autoComplete="off" tabIndex={-1} />
          </Form.Item>

          <Form.Item
            name="fullName"
            label={t("contact.field.fullName")}
            rules={[{ required: true, message: t("contact.field.fullNameRequired") }]}
          >
            <Input maxLength={80} autoComplete="name" />
          </Form.Item>

          <Form.Item
            name="email"
            label={t("contact.field.email")}
            rules={[
              { required: true, message: t("contact.field.emailRequired") },
              { type: "email", message: t("contact.field.emailInvalid") }
            ]}
          >
            <Input maxLength={120} autoComplete="email" />
          </Form.Item>

          <Form.Item name="phone" label={t("contact.field.phone")}>
            <Input maxLength={30} autoComplete="tel" />
          </Form.Item>

          <Form.Item name="company" label={t("contact.field.company")}>
            <Input maxLength={120} autoComplete="organization" />
          </Form.Item>

          <Form.Item name="fleetSize" label={t("contact.field.fleetSize")}>
            <Input maxLength={40} placeholder={t("contact.field.fleetSize.placeholder")} />
          </Form.Item>

          <Form.Item
            name="message"
            label={t("contact.field.message")}
            rules={[{ required: true, message: t("contact.field.messageRequired") }]}
          >
            <Input.TextArea
              rows={4}
              maxLength={2000}
              showCount
              placeholder={t("contact.field.messagePlaceholder")}
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={handleClose} disabled={loading}>{t("contact.cancel")}</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t("contact.submit")}
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
