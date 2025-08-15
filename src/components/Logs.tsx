import { useState } from "react";

export function useLogs() {
    const [logs, setLogs] = useState<string[]>([]);
    const pushLog = (s: string) => setLogs((L) => [...L, s]);

    const Logs = () => (
        <div style={{ flex: 1 }}>
        <h3>Log</h3>
        <pre
            style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                border: "1px solid #ddd",
                padding: 12,
                height: 300,
                overflow: "auto",
            }}
        >
            {logs.join("\n")}
        </pre>
    </div>
    )
    return { pushLog, Logs };
}