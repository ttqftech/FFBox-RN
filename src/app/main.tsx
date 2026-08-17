import { useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { appStore } from '../stores/appStore';
import { ServiceBridgeStatus } from '../bridges/serviceBridge';

/** 主界面任务列表（步骤 2 最简版）：显示任务标题 + 进度 */
export default function MainScreen() {
  const router = useRouter();
  const snap = useSnapshot(appStore);
  const server = snap.currentServer;
  const tasks = server?.data.tasks ?? [];
  const progress = server?.data.progress ?? -1;

  const handleDisconnect = () => {
    if (server) appStore.removeServer(server.data.id);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.ipText} numberOfLines={1}>
            {server?.entity.ip ? `${server.entity.ip}:${server.entity.port}` : '未连接'}
          </Text>
          {server?.entity.status === ServiceBridgeStatus.Connected ? (
            <Text style={styles.statusText}>已连接</Text>
          ) : (
            <Text style={[styles.statusText, styles.statusReconnecting]}>重连中…</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>断开</Text>
        </TouchableOpacity>
      </View>

      {snap.servers.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.hintText}>未连接服务器</Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => {
            const run = item.runs[item.runs.length - 1];
            const pct = Math.round((run?.dashboard_smooth.progress ?? 0) * 100);
            return (
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.taskName || `(无任务名, id: ${item.id})`}
                </Text>
                <Text style={styles.pct}>{pct}%</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.hintText}>暂无任务</Text>
            </View>
          }
        />
      )}

      {progress >= 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>队列总进度 {(progress * 100).toFixed(0)}%</Text>
        </View>
      )}
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
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  ipText: { fontSize: 16, fontWeight: '600', color: '#333', flexShrink: 1 },
  statusText: { fontSize: 12, color: '#2e9e44', marginLeft: 8 },
  statusReconnecting: { color: '#e6a23c' },
  disconnectText: { fontSize: 15, color: '#208AEF' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  name: { flex: 1, fontSize: 15, color: '#333', marginRight: 12 },
  pct: { fontSize: 15, fontWeight: '600', color: '#208AEF' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  hintText: { fontSize: 14, color: '#aaa' },
  footer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  footerText: { fontSize: 13, color: '#666' },
});
