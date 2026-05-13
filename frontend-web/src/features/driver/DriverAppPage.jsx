import { CameraOutlined, CheckCircleOutlined, EnvironmentOutlined, LoadingOutlined, PhoneOutlined, PlayCircleOutlined, StopOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Card, Drawer, Empty, Form, Input, InputNumber, List, message, Modal, Select, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { driverAppApi } from "../../api/trip";

const { Text, Title } = Typography;

const taskColor = {
  PENDING: "default",
  EN_ROUTE: "blue",
  ARRIVED: "gold",
  COMPLETED: "green",
  FAILED: "red"
};

function money(v) {
  return Number(v || 0).toLocaleString("vi-VN") + " đ";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DriverAppPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [failOpen, setFailOpen] = useState(false);
  const [podImage, setPodImage] = useState("");
  const [form] = Form.useForm();

  const tripsQ = useQuery({ queryKey: ["driver-trips"], queryFn: () => driverAppApi.listTrips(), refetchInterval: 15000 });
  const trips = tripsQ.data?.data ?? [];
  const tripId = selectedId ?? trips[0]?._id;
  const tripQ = useQuery({ queryKey: ["driver-trip", tripId], queryFn: () => driverAppApi.getTrip(tripId), enabled: !!tripId, refetchInterval: 10000 });
  const trip = tripQ.data?.data;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["driver-trips"] });
    qc.invalidateQueries({ queryKey: ["driver-trip", tripId] });
  };
  const actionM = useMutation({ mutationFn: ({ fn }) => fn(), onSuccess: invalidate, onError: (e) => message.error(e.message) });
  const taskM = useMutation({
    mutationFn: ({ stopIndex, action, payload }) => driverAppApi.taskAction(tripId, stopIndex, action, payload),
    onSuccess: () => { invalidate(); setCompleteOpen(false); setFailOpen(false); setActiveTask(null); form.resetFields(); setPodImage(""); },
    onError: (e) => message.error(e.message)
  });

  useEffect(() => {
    if (!tripId || !navigator.geolocation || !["LOADING", "IN_PROGRESS"].includes(trip?.Status)) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        driverAppApi.gps(tripId, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed ?? 0
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [tripId, trip?.Status]);

  const nextTask = useMemo(() => trip?.Tasks?.find((task) => !["COMPLETED", "FAILED"].includes(task.Status)), [trip]);

  if (!trip && trips.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f6fb", padding: 16 }}>
        <Title level={4}>Driver App</Title>
        <Empty description="Chưa có chuyến giao được giao cho tài xế này" />
      </div>
    );
  }

  const openNavigate = (task) => {
    if (task?.Latitude && task?.Longitude) window.open(`https://www.google.com/maps/dir/?api=1&destination=${task.Latitude},${task.Longitude}`, "_blank");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f6fb", padding: 12, maxWidth: 520, margin: "0 auto" }}>
      <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }}>
        <Space direction="vertical" size={6} style={{ width: "100%" }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Title level={4} style={{ margin: 0 }}>Chuyến giao hàng</Title>
            <Tag color="blue">{trip?.Status ?? "ASSIGNED"}</Tag>
          </Space>
          <Text strong>{trip?.TripCode}</Text>
          <Text type="secondary">{dayjs(trip?.PlanDate).format("DD/MM/YYYY")} · {trip?.VehicleCode} · {trip?.DriverName}</Text>
          <Text type="secondary">Chạy: {trip?.PlannedStartTime || "--:--"} - {trip?.PlannedReturnTime || "--:--"}</Text>
          <Space wrap>
            <Button icon={<CheckCircleOutlined />} disabled={trip?.Status !== "ASSIGNED"} onClick={() => actionM.mutate({ fn: () => driverAppApi.confirm(tripId) })}>Xác nhận</Button>
            <Button icon={<LoadingOutlined />} disabled={!["ASSIGNED", "DRIVER_CONFIRMED"].includes(trip?.Status)} onClick={() => actionM.mutate({ fn: () => driverAppApi.loading(tripId) })}>Bốc hàng</Button>
            <Button type="primary" icon={<PlayCircleOutlined />} disabled={["IN_PROGRESS", "COMPLETED"].includes(trip?.Status)} onClick={() => actionM.mutate({ fn: () => driverAppApi.start(tripId) })}>Xuất kho</Button>
          </Space>
        </Space>
      </Card>

      {trips.length > 1 && (
        <Select value={tripId} onChange={setSelectedId} style={{ width: "100%", marginBottom: 12 }}>
          {trips.map((item) => <Select.Option key={item._id} value={item._id}>{item.TripCode} · {dayjs(item.PlanDate).format("DD/MM")}</Select.Option>)}
        </Select>
      )}

      <List
        dataSource={trip?.Tasks ?? []}
        renderItem={(task) => (
          <Card
            size="small"
            onClick={() => setActiveTask(task)}
            style={{
              marginBottom: 10,
              borderRadius: 12,
              borderColor: nextTask?.StopIndex === task.StopIndex ? "#1677ff" : "#d9e2ef",
              opacity: ["COMPLETED", "FAILED"].includes(task.Status) ? 0.72 : 1
            }}
          >
            <Space align="start" style={{ width: "100%" }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: task.Status === "COMPLETED" ? "#16a34a" : task.Status === "FAILED" ? "#dc2626" : "#1677ff", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
                {task.StopIndex}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Text strong>{task.CustomerName}</Text>
                  <Tag color={taskColor[task.Status]}>{task.Status}</Tag>
                </Space>
                <Text type="secondary">{task.PlannedArrivalTime || "--:--"} · {task.Address}</Text>
                <br />
                <Text type="secondary">{task.OrderCodes?.join(", ")} · COD {money(task.CODAmount)}</Text>
              </div>
            </Space>
          </Card>
        )}
      />

      <Button block danger icon={<StopOutlined />} disabled={!trip?.Tasks?.every((task) => ["COMPLETED", "FAILED"].includes(task.Status)) || trip?.Status === "COMPLETED"} onClick={() => actionM.mutate({ fn: () => driverAppApi.finish(tripId) })}>
        Kết thúc chuyến tại kho
      </Button>

      <Drawer open={!!activeTask} onClose={() => setActiveTask(null)} placement="bottom" height="78%" title={activeTask?.CustomerName}>
        {activeTask && (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text>{activeTask.Address}</Text>
            <Text type="secondary">{activeTask.OrderCodes?.join(", ")} · COD {money(activeTask.CODAmount)}</Text>
            <Space wrap>
              <Button type="primary" icon={<EnvironmentOutlined />} onClick={() => openNavigate(activeTask)}>Chỉ đường</Button>
              <Button icon={<PhoneOutlined />} href={activeTask.Phone ? `tel:${activeTask.Phone}` : undefined}>Gọi khách</Button>
            </Space>
            <Space wrap>
              <Button onClick={() => taskM.mutate({ stopIndex: activeTask.StopIndex, action: "en-route" })}>Đang tới</Button>
              <Button onClick={() => taskM.mutate({ stopIndex: activeTask.StopIndex, action: "arrive" })}>Đã đến</Button>
              <Button type="primary" onClick={() => { setCompleteOpen(true); form.setFieldsValue({ cashCollected: activeTask.CODAmount }); }}>Hoàn thành</Button>
              <Button danger onClick={() => setFailOpen(true)}>Thất bại</Button>
            </Space>
          </Space>
        )}
      </Drawer>

      <Modal open={completeOpen} title="Proof of Delivery" onCancel={() => setCompleteOpen(false)} onOk={() => form.validateFields().then((v) => taskM.mutate({ stopIndex: activeTask.StopIndex, action: "complete", payload: { ...v, podImages: podImage ? [podImage] : [] } }))}>
        <Form form={form} layout="vertical">
          <Form.Item label="Tiền thu" name="cashCollected"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item label="Chữ ký / ghi chú xác nhận" name="signatureImage"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Ảnh giao hàng">
            <input type="file" accept="image/*" onChange={async (e) => setPodImage(e.target.files?.[0] ? await readFileAsDataUrl(e.target.files[0]) : "")} />
            {podImage && <Tag icon={<CameraOutlined />} color="green" style={{ marginTop: 8 }}>Đã chọn ảnh</Tag>}
          </Form.Item>
          <Form.Item label="Ghi chú" name="note"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={failOpen} title="Giao thất bại" onCancel={() => setFailOpen(false)} onOk={() => form.validateFields().then((v) => taskM.mutate({ stopIndex: activeTask.StopIndex, action: "fail", payload: v }))}>
        <Form form={form} layout="vertical">
          <Form.Item label="Lý do" name="reason" rules={[{ required: true }]}>
            <Select options={["Khách không nghe máy", "Sai địa chỉ", "Hàng hỏng", "Khách từ chối", "Khác"].map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item label="Ghi chú" name="note"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
