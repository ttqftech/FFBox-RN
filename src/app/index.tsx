import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testConnect } from '../bridges/minConnect';
import { setCurrentConnect } from '../bridges/session';
import { getServersInfo, saveServersInfo, ServerInfo } from '../common/storage';

/** 与某个服务器信息是否同一条（忽略密码） */
function isSameServer(a: ServerInfo, b: ServerInfo) {
  return a.ip === b.ip && a.port === b.port && a.username === b.username;
}

export default function LoginScreen() {
  const router = useRouter();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recent, setRecent] = useState<ServerInfo[]>([]);
  const [connecting, setConnecting] = useState(false);

  const refreshRecent = async () => {
    setRecent(await getServersInfo());
  };

  useEffect(() => {
    refreshRecent();
  }, []);

  const fillFromRecent = (item: ServerInfo) => {
    setIp(item.ip);
    setPort(item.port);
    setUsername(item.username);
    setPassword(item.password);
  };

  const removeRecent = async (item: ServerInfo) => {
    const list = await getServersInfo();
    await saveServersInfo(list.filter((s) => !isSameServer(s, item)));
    refreshRecent();
  };

  const handleConnect = async () => {
    if (!ip.length || isNaN(Number(port))) {
      Alert.alert('提示', '请输入正确的 IP 与端口');
      return;
    }
    setConnecting(true);
    try {
      const handle = await testConnect(ip, port, username, password, {
        onDisconnect: () => {
          // Alert.alert('掉线', '与服务器的连接已断开，请重试');
          // router.replace('/');
          setCurrentConnect(null);
          console.log('掉线');
        },
      });
      setCurrentConnect(handle);

      // 更新最近使用列表（同一条则更新密码，否则追加）
      const list = await getServersInfo();
      const info: ServerInfo = { ip, port, username, password };
      const idx = list.findIndex((s) => isSameServer(s, info));
      if (idx >= 0) list[idx] = info;
      else list.push(info);
      await saveServersInfo(list);
      refreshRecent();

      router.replace('/main');
    } catch (e: any) {
      Alert.alert('连接失败', e?.message || '未知错误');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.form}>
          <Text style={styles.title}>连接服务器</Text>

          <View style={styles.box}>
            <TextInput placeholder="IP" placeholderTextColor="#999" value={ip} onChangeText={setIp} autoCapitalize="none" style={styles.input} />
            <TextInput placeholder="端口" placeholderTextColor="#999" value={port} onChangeText={setPort} keyboardType="number-pad" style={styles.input} />
            <TextInput placeholder="用户名" placeholderTextColor="#999" value={username} onChangeText={setUsername} autoCapitalize="none" style={styles.input} />
            <TextInput placeholder="密码" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
          </View>

          <TouchableOpacity disabled={connecting} onPress={handleConnect} style={[styles.button, connecting && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{connecting ? '连接中…' : '连接'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentArea}>
          <Text style={styles.sectionTitle}>最近使用</Text>
          <FlatList
            data={recent}
            keyExtractor={(item, i) => `${item.ip}:${item.port}:${item.username}:${i}`}
            renderItem={({ item }) => (
              <View style={styles.recentRow}>
                <Pressable style={styles.recentMain} onPress={() => fillFromRecent(item)}>
                  <Text style={styles.recentText} numberOfLines={1}>
                    {item.ip}:{item.port}{item.username ? `@${item.username}` : ''}
                  </Text>
                </Pressable>
                <TouchableOpacity onPress={() => removeRecent(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.removeText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>暂无历史记录</Text>}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f3f5' },
  flex: { flex: 1 },
  form: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: '#222', marginBottom: 20 },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    // FFBox 风格：上亮光 + 包边
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  button: {
    marginTop: 20,
    width: '100%',
    maxWidth: 360,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  recentArea: {
    maxHeight: '35%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  sectionTitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  recentMain: { flex: 1 },
  recentText: { fontSize: 15, color: '#333' },
  removeText: { fontSize: 14, color: '#999', paddingHorizontal: 8 },
  emptyText: { color: '#999', fontSize: 14, paddingVertical: 10 },
});
