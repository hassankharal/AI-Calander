import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  Modal
} from 'react-native';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { supabase } from '../lib/supabaseClient';
import { ChatMessage, Proposal } from '../types/scheduler';

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export default function SchedulerScreen() {
  const { addTask, tasks } = useTasks();
  const { events, addEvent } = useEvents();

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);

  // Edit Modal State
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: inputText,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const context = {
        tasks: tasks.filter(t => !t.completed),
        events: events,
        prefs: {}
      };

      const { data, error } = await supabase.functions.invoke('ai-scheduler', {
        body: {
          message: inputText,
          nowIso: new Date().toISOString(),
          timezone: 'America/Winnipeg',
          context
        }
      });

      if (error) throw error;

      if (data) {
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: data.assistantText,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);

        // Ensure proposals have IDs for React keys
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newProposals: Proposal[] = (data.proposals || []).map((p: any) => ({
          ...p,
          id: p.id || makeId(),
        }));
        setPendingProposals(newProposals);
      }

    } catch (err: unknown) {
      console.error("AI Request Failed", err);

      // Read the underlying Response from error.context (if present)
      // We cast as any to safely access custom properties on the error object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx: any = (err as any).context;
      if (ctx) {
        console.error('Function status:', ctx.status);
        try {
          // Clone response or just read text if allowed
          const txt = await ctx.text();
          console.error('Function body:', txt);
        } catch (e) {
          console.error('Could not read response body', e);
        }
      }

      const errorMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: "AI request failed. Check logs for details.",
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleConfirmProposal = async (proposal: Proposal) => {
    try {
      if (proposal.type === 'task') {
        await addTask({
          title: proposal.title,
          notes: proposal.notes,
          dueDate: proposal.dueDate
        });
      } else if (proposal.type === 'event') {
        if (proposal.startAt && proposal.endAt) {
          await addEvent({
            title: proposal.title,
            startAt: proposal.startAt,
            endAt: proposal.endAt,
            location: proposal.location || undefined,
            notes: proposal.notes || undefined,
          })
        } else {
          console.warn("Event proposal missing dates", proposal);
        }
      }

      const successMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: "Saved ✅",
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, successMsg]);

      setPendingProposals(prev => prev.filter(p => p.id !== proposal.id));

    } catch (error) {
      console.error("Failed to save item", error);
    }
  };

  const handleEditProposal = (proposal: Proposal) => {
    setEditingProposal(proposal);
    setEditTitle(proposal.title);
    setEditDueDate(proposal.dueDate || '');
    setEditNotes(proposal.notes || '');
    setEditError(null);
  };

  const saveEdit = () => {
    if (!editingProposal) return;
    if (!editTitle.trim()) {
      setEditError("Title is required");
      return;
    }

    if (editDueDate.trim() && editingProposal.type === 'task') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(editDueDate.trim())) {
        setEditError("Date must be YYYY-MM-DD");
        return;
      }
    }

    setPendingProposals(prev => prev.map(p =>
      p.id === editingProposal.id
        ? { ...p, title: editTitle.trim(), dueDate: editDueDate.trim() || undefined, notes: editNotes.trim() || undefined }
        : p
    ));

    setEditingProposal(null);
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, pendingProposals]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[
        styles.messageBubble,
        isUser ? styles.userBubble : styles.assistantBubble
      ]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {item.text}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View>
              {pendingProposals.map(proposal => (
                <View key={proposal.id} style={styles.proposalCard}>
                  <View style={styles.proposalHeader}>
                    <Text style={styles.proposalType}>{proposal.type.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.proposalTitle}>{proposal.title}</Text>
                  {proposal.startAt && (
                    <Text style={styles.proposalDetail}>🕒 {new Date(proposal.startAt).toLocaleString()}</Text>
                  )}
                  {proposal.dueDate && (
                    <Text style={styles.proposalDetail}>📅 {proposal.dueDate}</Text>
                  )}
                  {proposal.notes && (
                    <Text style={styles.proposalDetail}>📝 {proposal.notes}</Text>
                  )}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => handleEditProposal(proposal)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={() => handleConfirmProposal(proposal)}
                    >
                      <Text style={styles.confirmButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a request (e.g. 'Buy milk today')"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={!!editingProposal}
          onRequestClose={() => setEditingProposal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit {editingProposal?.type}</Text>

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.modalInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Task title"
              />

              <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.modalInput}
                value={editDueDate}
                onChangeText={setEditDueDate}
                placeholder="2026-01-01"
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.notesInput]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Add notes..."
                multiline
              />

              {editError && <Text style={styles.errorText}>{editError}</Text>}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditingProposal(null)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveEdit}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
  },
  proposalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    marginBottom: 20,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
  },
  proposalHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  proposalType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8e8e93',
    backgroundColor: '#f2f2f7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  proposalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  proposalDetail: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#34C759',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  editButton: {
    backgroundColor: '#E5E5EA',
  },
  editButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 16,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#E5E5EA',
  },
  cancelButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
});
