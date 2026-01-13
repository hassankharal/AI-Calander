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
  SafeAreaView
} from 'react-native';
import { useTasks } from '../hooks/useTasks';
import { parseUserRequest } from '../ai/localScheduler';
import { ChatMessage, Proposal } from '../types/scheduler';

const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

export default function SchedulerScreen() {
  const { addTask } = useTasks();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // We keep track of the *current* proposal(s) waiting for confirmation
  // In a more complex app, we might attach proposals to specific messages, 
  // but for now, we just clear them when handled.
  const [pendingProposals, setPendingProposals] = useState<Proposal[]>([]);

  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      text: inputText,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Process with AI stub
    const response = parseUserRequest(inputText, new Date());

    // Slight delay to feel like "thinking"
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        text: response.assistantText,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setPendingProposals(response.proposals);
    }, 500);
  };

  const handleConfirmProposal = async (proposal: Proposal) => {
    try {
      if (proposal.type === 'task') {
        await addTask({
          title: proposal.title,
          notes: proposal.notes,
          dueDate: proposal.dueDate
        });

        const successMsg: ChatMessage = {
          id: makeId(),
          role: 'assistant',
          text: "Saved ✅",
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, successMsg]);
        setPendingProposals([]); // Clear pending after success
      }
    } catch (error) {
      console.error("Failed to save task", error);
    }
  };

  useEffect(() => {
    // Auto-scroll to bottom of chat
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
                  {proposal.dueDate && (
                    <Text style={styles.proposalDetail}>📅 {proposal.dueDate}</Text>
                  )}
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => handleConfirmProposal(proposal)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
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
  // Proposal Card Styles
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
    marginBottom: 12,
  },
  confirmButton: {
    backgroundColor: '#34C759',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
