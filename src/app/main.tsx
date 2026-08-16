import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentConnect, setCurrentConnect } from '../bridges/session';

/** 主界面占位页：本步仅展示连接信息，完整任务列表见步骤 3 */
export default function MainScreen() {
  const router = useRouter();
  const handle = currentConnect;

  const handleDisconnect = () => {
    handle?.close();
    setCurrentConnect(null);
    router.replace('/');
  };

  const handlePlaceholder = () => {
    Alert.alert('提示', '主界面（任务列表）将在后续步骤实现');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.ipText}>
          {handle ? `${handle.ip}:${handle.port}` : '未连接'}
        </Text>
        <TouchableOpacity onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>断开</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.body} onPress={handlePlaceholder} activeOpacity={0.8}>
        <Text style={styles.placeholderText}>主界面（待实现）</Text>
        <Text style={styles.hintText}>任务列表将在后续步骤实现，点击此处可查看提示</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f3f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  ipText: { fontSize: 16, fontWeight: '600', color: '#333' },
  disconnectText: { fontSize: 15, color: '#208AEF' },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  placeholderText: { fontSize: 20, fontWeight: '600', color: '#888' },
  hintText: { marginTop: 8, fontSize: 14, color: '#aaa', textAlign: 'center' },
});