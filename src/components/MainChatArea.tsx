import { Send } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { useState } from "react";

interface MainChatAreaProps {
    messages: string[];
    sendMessage: (message: string) => void;
}
export function MainChatArea(props: MainChatAreaProps) {
    const [input, setInput] = useState("");

    return (
        <div className="flex-1 flex flex-col bg-[#36393f]">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {props.messages.map((message, index) => (
                        <div key={index} className="group">
                            <div className="flex items-start space-x-3">
                                <div className="flex-1">
                                    <p className="text-[#dcddde]">{message}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 bg-[#36393f]">
                <div className="flex space-x-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Message this room..."
                        className="flex-1 bg-[#40444b] border-[#40444b] text-[#dcddde] placeholder-[#72767d] focus:border-[#5865f2]"
                        onKeyPress={(e) => e.key === 'Enter' && props.sendMessage(input)}
                    />
                    <Button
                        onClick={() => { props.sendMessage(input) }}
                        size="sm"
                        className="bg-[#5865f2] hover:bg-[#4752c4] text-white"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}