import { SafeScreen } from '../components/SafeScreen';
import { showAlert } from '../store/alert';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView as RNScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, Send, Sparkles, Image as ImageIcon, X, Clock } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../services/api';
import { useApp } from '../store/app';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  text: string;
  json?: any;
  imageUrl?: string;
  timestamp: number;
};

type Props = {
  onClose: () => void;
  onBook: (jobId: string) => void;
};

const SESSION_ID_KEY = 'crewli_chat_session';

function generateSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function timeAgo(dateStr: string | number | Date): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function AIScreen({ onClose, onBook }: Props) {
  const { colors, isDark } = useTheme();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const [imageAsset, setImageAsset] = useState<{ uri: string; base64: string } | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [sessions, setSessions] = useState<{ sessionId: string; updatedAt: string; preview: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Typing indicator dots animation
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) return;
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );
    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [loading]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Save chat history to server
  const saveChatHistory = useCallback(async (msgs: ChatMessage[]) => {
    try {
      const customerId = useApp.getState().customerId;
      await api.saveChatHistory(sessionId, msgs, customerId);
    } catch { }
  }, [sessionId]);

  async function openHistory() {
    setHistoryVisible(true);
    try {
      const customerId = useApp.getState().customerId;
      if (customerId) {
        const res = await api.listChatSessions(customerId);
        if (res.sessions) {
          setSessions(res.sessions);
        }
      }
    } catch { }
  }

  async function pickImage() {
    launchImageLibrary(
      { mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 1024, maxHeight: 1024 },
      (res: ImagePickerResponse) => {
        if (res.didCancel || res.errorCode) return;
        const asset = res.assets?.[0];
        if (asset?.uri && asset?.base64) {
          setImageAsset({ uri: asset.uri, base64: asset.base64 });
        }
      }
    );
  }

  async function sendToAI() {
    const text = prompt.trim();
    if (!text && !imageAsset) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: text || 'Image attached',
      imageUrl: imageAsset?.uri,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setPrompt('');
    const capturedImage = imageAsset;
    setImageAsset(null);
    scrollToEnd();

    setLoading(true);
    try {
      const customerId = useApp.getState().customerId;
      const customerName = useApp.getState().name || undefined;
      const res = await api.askAI(text, capturedImage?.base64, sessionId, customerId, customerName);
      
      // Update session ID if backend returned a new one
      if (res.sessionId && res.sessionId !== sessionId) {
        setSessionId(res.sessionId);
      }

      let parsed = null;
      let aiText = res.response;

      const jsonBlockMatch = res.response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        try {
          parsed = JSON.parse(jsonBlockMatch[1]);
          aiText = res.response.split('```json')[0].replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').trim();
        } catch (e) { }
      } else {
        const fallbackMatch = res.response.match(/\{[\s\S]*\}/);
        if (fallbackMatch) {
          try {
            parsed = JSON.parse(fallbackMatch[0]);
            aiText = res.response.replace(fallbackMatch[0], '').replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').replace(/```/g, '').trim();
          } catch (e) { }
        }
      }

      // Final cleanup
      aiText = aiText.replace(/USER MESSAGE: ".*?"/s, '').trim();

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'ai',
        text: aiText || 'I can help with that!',
        json: parsed,
        timestamp: Date.now(),
      };

      const allMessages = [...updatedMessages, aiMsg];
      setMessages(allMessages);
      scrollToEnd();
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        role: 'ai',
        text: 'Sorry, I had trouble processing that. Please try again.',
        timestamp: Date.now(),
      };
      const allMessages = [...updatedMessages, errorMsg];
      setMessages(allMessages);
      scrollToEnd();
    } finally {
      setLoading(false);
    }
  }

  async function handleBookNow(msg: ChatMessage) {
    if (!msg.json?.category) return;
    setLoading(true);
    try {
      const c = await api.getCatalog();
      const cat = msg.json.category;
      const skillEntry = Object.entries(c.skills).find(([k, v]) => v.category === cat);
      if (!skillEntry) {
        showAlert('Could not find a service for this category.');
        return;
      }

      const loc = useApp.getState().location;
      if (!loc) {
        showAlert('Location required');
        return;
      }
      const jobRes = await api.createJob({
        skillKey: skillEntry[0],
        customerLocation: loc,
        customerId: useApp.getState().customerId,
        address: useApp.getState().address,
        customerName: useApp.getState().name,
        customerPhone: useApp.getState().phone || undefined,
        notes: prompt || msg.text,
      });
      useApp.getState().setActiveJob(jobRes.jobId);
      onBook(jobRes.jobId);
    } catch (e: any) {
      showAlert('Booking Error', e?.message || 'Failed to book');
    } finally {
      setLoading(false);
    }
  }

  const renderTypingIndicator = () => {
    if (!loading) return null;
    const dotStyle = (anim: Animated.Value) => ({
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    });
    return (
      <View style={[styles.messageBubbleLeft, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
        <View style={styles.typingRow}>
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dotStyle(dot1)]} />
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dotStyle(dot2)]} />
          <Animated.View style={[styles.typingDot, { backgroundColor: colors.accent }, dotStyle(dot3)]} />
        </View>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.messageRowRight}>
          <View style={[styles.messageBubbleRight, { backgroundColor: '#311090' }]}>
            {item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={{ width: 160, height: 160, borderRadius: 8, marginBottom: 8 }} />
            )}
            <Text style={styles.messageTextRight}>{item.text}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.messageRowLeft}>
        <View style={[styles.aiBubbleAvatar, { backgroundColor: isDark ? '#1e1b4b' : '#EDE9FE' }]}>
          <Sparkles size={14} color="#311090" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.messageBubbleLeft, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
            <Text style={[styles.messageTextLeft, { color: colors.text }]}>{item.text}</Text>
          </View>
          {item.json?.suggest_booking && (
            <TouchableOpacity
              style={styles.bookNowBtn}
              onPress={() => handleBookNow(item)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size={16} />
              ) : (
                <Text style={styles.bookNowText}>Book a professional now</Text>
              )}
            </TouchableOpacity>
          )}
          {item.json && !item.json.suggest_booking && item.json.category && (
            <View style={[styles.infoChip, { backgroundColor: isDark ? '#1e1b4b' : '#EDE9FE' }]}>
              <Text style={[styles.infoChipText, { color: '#311090' }]}>
                {item.json.urgency === 'high' ? '● ' : item.json.urgency === 'medium' ? '● ' : '● '}
                {item.json.issue || item.json.category}
                {item.json.price_range ? ` · ${item.json.price_range}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.heroWrap}>
        <View style={styles.heroLeft}>
          <Text style={[styles.heroTitle, { color: '#311090' }]}>Hi! I'm Crewli AI</Text>
          <Text style={[styles.heroSub, { color: '#4B5563' }]}>
            I'm here to help you get unstuck. Ask me anything.
          </Text>
        </View>
        <View style={styles.heroImgWrap}>
          <Image
            source={require('../images/ai-home.png')}
            style={styles.heroImg}
            resizeMode="contain"
          />
        </View>
      </View>

      <View style={styles.suggestionsContainer}>
        <Text style={[styles.suggestionsTitle, { color: colors.textFaint }]}>Try asking about:</Text>
        {[
          'My tap is leaking badly',
          'Fan is making noise',
          'Door hinge is broken',
          'Wall has damp patches',
        ].map((suggestion, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.suggestionChip, { backgroundColor: isDark ? '#1F2937' : '#F8F5FF', borderColor: isDark ? '#374151' : '#E9D5FF' }]}
            onPress={() => {
              // Auto-send
              const userMsg: ChatMessage = {
                id: `user_${Date.now()}`,
                role: 'user',
                text: suggestion,
                timestamp: Date.now(),
              };
              setMessages([userMsg]);
              setLoading(true);
              scrollToEnd();

              const customerId = useApp.getState().customerId;
              const customerName = useApp.getState().name || undefined;
              api.askAI(suggestion, undefined, sessionId, customerId, customerName).then(res => {
                let parsed: any = null;
                let aiText = res.response;
                const jsonBlockMatch = res.response.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonBlockMatch) {
                  try {
                    parsed = JSON.parse(jsonBlockMatch[1]);
                    aiText = res.response.split('```json')[0].replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').trim();
                  } catch (e) { }
                } else {
                  const fallbackMatch = res.response.match(/\{[\s\S]*\}/);
                  if (fallbackMatch) {
                    try {
                      parsed = JSON.parse(fallbackMatch[0]);
                      aiText = res.response.replace(fallbackMatch[0], '').replace(/STRUCTURED JSON:/i, '').replace(/USER MESSAGE:/i, '').replace(/```/g, '').trim();
                    } catch (e) { }
                  }
                }
                aiText = aiText.replace(/USER MESSAGE: ".*?"/s, '').trim();
                const aiMsg: ChatMessage = {
                  id: `ai_${Date.now()}`,
                  role: 'ai',
                  text: aiText || 'I can help with that!',
                  json: parsed,
                  timestamp: Date.now(),
                };
                setMessages(prev => [...prev, aiMsg]);
                setPrompt('');
                scrollToEnd();
                saveChatHistory([userMsg, aiMsg]);
              }).catch(() => {
                const errMsg: ChatMessage = {
                  id: `ai_err_${Date.now()}`,
                  role: 'ai',
                  text: 'Sorry, I had trouble processing that. Please try again.',
                  timestamp: Date.now(),
                };
                setMessages(prev => [...prev, errMsg]);
                setPrompt('');
                scrollToEnd();
              }).finally(() => setLoading(false));
            }}
          >
            <Sparkles size={14} color="#311090" />
            <Text style={[styles.suggestionText, { color: '#311090' }]}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const hasMessages = messages.length > 0;

  return (
    <SafeScreen style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header — tightly packed, no gap between back and logo */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Image source={require('../images/main.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.headerRight}>
        {/*    <TouchableOpacity
            style={styles.historyBtn}
            onPress={openHistory}
          >
            <Clock size={16} color="#311090" />
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>*/}
          <View style={styles.readyPill}>
            <View style={styles.readyDot} />
            <Text style={styles.readyText}>Ready</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {!hasMessages ? (
          renderWelcome()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatContainer}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToEnd()}
            ListFooterComponent={renderTypingIndicator}
          />
        )}

        <View style={styles.bottomArea}>
          {/* Image preview */}
          {imageAsset ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.imageRemoveBtn} onPress={() => setImageAsset(null)}>
                <X size={14} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.imagePreviewLabel, { color: '#6B7280' }]}>Image attached</Text>
            </View>
          ) : null}

          <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#1F2937' : '#fff', borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
            {/* Image picker button */}
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage} disabled={loading}>
              <ImageIcon size={20} color={imageAsset ? '#311090' : (isDark ? '#9CA3AF' : '#6B7280')} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Ask anything..."
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { color: colors.text }]}
              multiline
              maxLength={500}
              onSubmitEditing={sendToAI}
              blurOnSubmit
            />
            <View style={styles.inputActions}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: (prompt.trim() || imageAsset) ? '#4F46E5' : isDark ? '#374151' : '#D1D5DB' }]}
                onPress={sendToAI}
                disabled={loading || (!prompt.trim() && !imageAsset)}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size={16} />
                ) : (
                  <Send size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Chat Sessions Sidebar */}
      <Modal
        visible={historyVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={hStyles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setHistoryVisible(false)} />
          <View style={[hStyles.sheet, { backgroundColor: colors.bg }]}>
            <View style={hStyles.sheetHandle} />
            <View style={hStyles.sheetHeader}>
              <Text style={[hStyles.sheetTitle, { color: colors.text }]}>Chats</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* New Chat button */}
            <TouchableOpacity
              style={[hStyles.newChatBtn, { backgroundColor: isDark ? '#312e81' : '#eef2ff' }]}
              onPress={() => {
                setMessages([]);
                setSessionId(generateSessionId());
                setHistoryVisible(false);
              }}
            >
              <Sparkles size={16} color={isDark ? '#818cf8' : '#4f46e5'} />
              <Text style={[hStyles.newChatText, { color: isDark ? '#818cf8' : '#4f46e5' }]}>New Chat</Text>
            </TouchableOpacity>

            {sessions.length === 0 ? (
              <View style={hStyles.emptyWrap}>
                <Clock size={36} color={colors.textFaint} />
                <Text style={[hStyles.emptyText, { color: colors.textMuted }]}>
                  No chat history yet.
                </Text>
                <Text style={[hStyles.emptyHint, { color: colors.textFaint }]}>
                  Start a conversation and it will appear here.
                </Text>
              </View>
            ) : (
              <RNScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {sessions.map((s) => {
                  const isActive = s.sessionId === sessionId;
                  return (
                    <TouchableOpacity
                      key={s.sessionId}
                      style={[
                        hStyles.sessionRow,
                        { backgroundColor: isActive ? (isDark ? '#1e1b4b' : '#eef2ff') : 'transparent' },
                      ]}
                      onPress={async () => {
                        try {
                          const customerId = useApp.getState().customerId;
                          if (customerId) {
                            const res = await api.loadChatHistory(customerId, s.sessionId);
                            if (res.messages?.length > 0) {
                              setMessages(res.messages);
                              setSessionId(s.sessionId);
                            }
                          }
                        } catch { }
                        setHistoryVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Sparkles size={16} color={isActive ? (isDark ? '#818cf8' : '#4f46e5') : colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            hStyles.sessionText,
                            { color: isActive ? (isDark ? '#c7d2fe' : '#312e81') : colors.text },
                            isActive && { fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {s.preview}
                        </Text>
                        <Text style={[hStyles.sessionTime, { color: colors.textFaint }]}>
                          {timeAgo(s.updatedAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </RNScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,        // very tight left — back btn handles its own padding
    paddingRight: 12,
    paddingVertical: 8,
  },
  backBtn: { padding: 8 },   // no negative margin so logo is close
  logo: { flex: 1, height: 30, marginLeft: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  historyBtnText: { fontSize: 12, fontWeight: '700', color: '#311090' },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  readyText: { fontSize: 11, fontWeight: '600', color: '#1F2937' },

  // Welcome / Hero
  welcomeContainer: { flex: 1, paddingHorizontal: 20 },
  heroWrap: {
    flexDirection: 'row',
    position: 'relative',
    height: 200,
    marginTop: 10,
  },
  heroLeft: {
    flex: 1.2,
    zIndex: 2,
    paddingTop: 10,
  },
  heroTitle: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  heroSub: { fontSize: 15, marginTop: 8, lineHeight: 22, opacity: 0.8 },
  heroImgWrap: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  heroImg: {
    width: 200,
    height: 200,
    position: 'absolute',
    right: -30,
    top: -10,
    zIndex: 1,
  },

  // Suggestions
  suggestionsContainer: { marginTop: 10, gap: 10 },
  suggestionsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 14, fontWeight: '500' },

  // Chat
  chatContainer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  messageRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
    paddingLeft: 50,
  },
  messageRowLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
    paddingRight: 50,
    gap: 8,
  },
  messageBubbleRight: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  messageBubbleLeft: {
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '100%',
  },
  messageTextRight: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextLeft: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiBubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  // Book Now
  bookNowBtn: {
    backgroundColor: '#311090',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  bookNowText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Info chip
  infoChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  infoChipText: { fontSize: 13, fontWeight: '600' },

  // Typing indicator
  typingRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Bottom input
  bottomArea: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  imagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  imagePreview: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  imageRemoveBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -14,
    marginTop: -14,
  },
  imagePreviewLabel: { fontSize: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 52,
  },
  imageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginRight: 8,
    marginLeft: 4,
    maxHeight: 100,
    paddingTop: 4,
    paddingBottom: 4,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const hStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  newChatText: { fontSize: 15, fontWeight: '800' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 4,
  },
  sessionText: { fontSize: 15, fontWeight: '500' },
  sessionTime: { fontSize: 12, fontWeight: '500', marginTop: 3 },
});
