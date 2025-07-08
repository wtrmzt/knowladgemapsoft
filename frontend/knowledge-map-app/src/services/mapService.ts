import apiClient from './apiClient';
import type { KnowledgeMap, TemporalRelatedNodesResponse, SuggestedNode } from '@/types';

interface SuggestRelatedNodesApiResponse {
  suggested_nodes: SuggestedNode[];
}

export const mapService = {
  getMap: async (memoId: number): Promise<KnowledgeMap> => {
    const response = await apiClient.get<KnowledgeMap>(`/maps/${memoId}`);
    return response.data;
  },
  generateMap: async (memoId: number): Promise<KnowledgeMap> => {
    const response = await apiClient.post<KnowledgeMap>(`/memos/${memoId}/generate_map`);
    return response.data;
  },
  updateMap: async (memoId: number, mapData: { nodes: any[], edges: any[] }): Promise<void> => {
    await apiClient.put(`/maps/${memoId}`, mapData);
  },
  suggestRelatedNodes: async (nodeLabel: string): Promise<SuggestRelatedNodesApiResponse> => {
    const encodedNodeLabel = encodeURIComponent(nodeLabel);
    const response = await apiClient.get<SuggestRelatedNodesApiResponse>(`/nodes/${encodedNodeLabel}/suggest_related`);
    return response.data;
  },
  suggestTemporalRelatedNodes: async (nodeInfo: { id: string, label: string }): Promise<TemporalRelatedNodesResponse> => {
    const response = await apiClient.post<TemporalRelatedNodesResponse>(`/temporal_related_nodes`, { node: nodeInfo });
    return response.data;
  }
};
