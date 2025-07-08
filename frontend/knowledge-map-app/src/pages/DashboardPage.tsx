// src/pages/DashboardPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import KnowledgeMapDisplay from '@/components/KnowledgeMapDisplay';
import MemoInput from '@/components/MemoInput';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { memoService } from '@/services/memoService';
import { mapService } from '@/services/mapService';
import type { Memo, CustomNodeType, KnowledgeMap } from '@/types';
import { Loader2, FileText, X, Brain } from 'lucide-react';

const loggingService = {
  logActivity: (type: string, details: any) => console.log(`[Log] ${type}`, details),
};

function DashboardPage() {
  const { toast } = useToast();
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeType[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [currentMemo, setCurrentMemo] = useState<Memo | null>(null);
  const [isMemoPanelOpen, setIsMemoPanelOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [layoutTrigger, setLayoutTrigger] = useState(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const applyMapData = useCallback((mapData: KnowledgeMap['map_data'] | null) => {
    if (mapData && Array.isArray(mapData.nodes)) {
      const loadedNodes: CustomNodeType[] = mapData.nodes.map((savedNode) => {
        const nodeData = savedNode.data || savedNode;
        return {
          id: String(savedNode.id),
          position: savedNode.position || { x: Math.random() * 400, y: Math.random() * 300 },
          type: savedNode.type || 'default',
          data: {
              label: nodeData.label, sentence: nodeData.sentence, apiNodeId: nodeData.apiNodeId || savedNode.id,
          },
        };
      });
      const loadedEdges: Edge[] = (mapData.edges || []).map((e) => ({
        id: String(e.id), source: String(e.source), target: String(e.target), animated: e.animated,
      }));
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setTimeout(() => setLayoutTrigger(p => p + 1), 100);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  const loadLatestData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const memos = await memoService.getMemos();
      if (memos && memos.length > 0) {
        const latestMemo = memos[0];
        setCurrentMemo(latestMemo);
        const mapResponse = await mapService.getMap(latestMemo.id);
        applyMapData(mapResponse.map_data);
      } else {
        setIsMemoPanelOpen(true);
      }
    } catch (error: any) {
      if (error?.response?.status !== 404) toast({ title: "データ読み込みエラー", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, applyMapData]);

  useEffect(() => { loadLatestData(); }, [loadLatestData]);

  useEffect(() => {
    if (isLoadingData || !currentMemo) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      const mapDataToSave = {
        nodes: nodes.map(n => ({ id: n.id, data: n.data, position: n.position, type: n.type })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, animated: e.animated })),
      };
      mapService.updateMap(currentMemo.id, mapDataToSave)
        .catch(() => toast({ title: "自動保存に失敗", variant: "destructive" }))
        .finally(() => setIsSaving(false));
    }, 2000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [nodes, edges, currentMemo, isLoadingData, toast]);

  const handleSaveAndGenerate = useCallback(async (text: string) => {
    if (!text.trim()) {
      toast({ title: "入力エラー", variant: "destructive" }); return;
    }
    setIsProcessing(true);
    loggingService.logActivity('SAVE_AND_GENERATE_MAP', { memoLength: text.length });
    try {
      const savedMemo = await memoService.createMemo(text);
      setCurrentMemo(savedMemo);
      toast({ title: "成功", description: "メモを保存しました。" });
      const mapResponse = await mapService.generateMap(savedMemo.id);
      applyMapData(mapResponse.map_data);
      toast({ title: "成功", description: "知識マップを生成しました。" });
    } catch (error: any) {
      toast({ title: "処理エラー", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setIsMemoPanelOpen(false);
    }
  }, [toast, applyMapData]);
  
  const onNodeAdded = useCallback((newNode: CustomNodeType | null, newEdge: Edge) => {
    if (newNode) setNodes((nds) => nds.concat(newNode));
    setEdges((eds) => eds.concat(newEdge));
  }, [setNodes, setEdges]);
  
  const onApplyTemporalMap = useCallback((newNodes: CustomNodeType[], newEdges: Edge[]) => {
      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
  }, [setNodes, setEdges]);

  return (
    <div className="w-screen h-screen bg-[#1a202c] text-white overflow-hidden relative font-sans">
      <main className={`absolute inset-0 transition-all duration-500 ease-in-out ${isMemoPanelOpen ? 'ml-[400px]' : 'ml-0'}`}>
        {isLoadingData ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
            <KnowledgeMapDisplay 
                nodes={nodes} edges={edges} onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange} layoutTrigger={layoutTrigger}
                onNodeAdded={onNodeAdded} onApplyTemporalMap={onApplyTemporalMap}
            />
        )}
      </main>
      <aside className={`absolute top-0 left-0 h-full w-[400px] bg-gray-900/80 backdrop-blur-md border-r border-blue-400/20 shadow-2xl transition-transform duration-500 ease-in-out z-30 ${isMemoPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center"><Brain className="mr-2"/>学習メモ</h2>
            <Button onClick={() => setIsMemoPanelOpen(false)} variant="ghost" size="icon"><X className="w-6 h-6" /></Button>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <MemoInput 
              initialText={currentMemo?.content || ''} onSave={handleSaveAndGenerate}
              isLoading={isProcessing} memoKey={currentMemo?.id}
            />
          </div>
        </div>
      </aside>
      <Button onClick={() => setIsMemoPanelOpen(true)} variant="ghost" size="icon" className="absolute top-1/2 right-8 -translate-y-1/2 bg-blue-500/80 hover:bg-blue-400/90 rounded-full w-20 h-20 backdrop-blur-sm z-20">
          <FileText className="w-10 h-10" />
      </Button>
      {isSaving && <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground animate-pulse">保存中...</div>}
    </div>
  );
}

export default DashboardPage;
