import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Settings } from "lucide-react";

export function SettingsDialog() {
    const [provider, setProvider] = useState("gemini");
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("gemini-1.5-flash-001");
    const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
    const [open, setOpen] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("ai_settings");
        if (saved) {
            const parsed = JSON.parse(saved);
            setProvider(parsed.provider || "gemini");
            setApiKey(parsed.apiKey || "");
            setModel(parsed.model || "gemini-1.5-flash-001");
            setOllamaUrl(parsed.ollamaUrl || "http://localhost:11434");
        }
    }, []);

    const handleSave = () => {
        const settings = { provider, apiKey, model, ollamaUrl };
        localStorage.setItem("ai_settings", JSON.stringify(settings));
        setOpen(false);
        // Dispatch event so other components can react if needed
        window.dispatchEvent(new Event("settings-changed"));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Settings" className="h-8 w-8">
                    <Settings className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>AI Provider</Label>
                        <Select value={provider} onValueChange={setProvider}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gemini">Google Gemini</SelectItem>
                                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                                <SelectItem value="mock">Mock (Testing)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {provider === "gemini" && (
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input
                                type="password"
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                                placeholder="Enter Gemini API Key"
                            />
                            <p className="text-xs text-gray-500">Stored locally in your browser.</p>
                        </div>
                    )}

                    {provider === "ollama" && (
                        <div className="space-y-2">
                            <Label>Ollama URL</Label>
                            <Input
                                value={ollamaUrl}
                                onChange={e => setOllamaUrl(e.target.value)}
                                placeholder="http://localhost:11434"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Model Name</Label>
                        <Input
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            placeholder={provider === "gemini" ? "gemini-1.5-flash-001" : "mistral"}
                        />
                    </div>

                    <Button onClick={handleSave} className="w-full">Save Settings</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
