import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  NativeModules,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Problem, SubProblem, Skill, AddOn, api, Job } from './services/api';
import { useApp } from './store/app';
import { registerFcmToken, onForegroundMessage, onTokenRefresh } from './services/fcm';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProblemListScreen } from './screens/ProblemListScreen';
import { ConfirmSheet } from './screens/ConfirmSheet';
import { SearchingScreen } from './screens/SearchingScreen';
import { MatchedScreen } from './screens/MatchedScreen';
import { ArrivedScreen } from './screens/ArrivedScreen';
import { CompletedScreen } from './screens/CompletedScreen';
import { RatingScreen } from './screens/RatingScreen';
import { PhoneScreen } from './screens/PhoneScreen';
import { OtpScreen } from './screens/OtpScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { AIScreen } from './screens/AIScreen';
import { MyProfileScreen } from './screens/MyProfileScreen';
import { AddressScreen } from './screens/AddressScreen';
import { ThemeProvider, useThemePref } from './theme/ThemeContext';
import { disconnectCustomerSocket } from './services/socket';
import { CustomAlert } from './components/CustomAlert';
import { showAlert } from './store/alert';

const ProgressNotification = NativeModules.ProgressNotification;

export type RootStackParamList = {
  Phone: undefined;
  Otp: { phone: string; devOtp?: string };
  Profile: undefined;
  Welcome: undefined;
  Home: undefined;
  Problems: { problem: Problem };
  Searching: { jobId: string };
  Matched: { jobId: string };
  Arrived: { jobId: string };
  Completed: { jobId: string; finalPrice: number };
  Rating: { jobId: string; finalPrice: number; workerName?: string };
  AI: undefined;
  MyProfile: undefined;
  Address: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();



// ── App root ───────────────────────────────────────────────────────────────
export default function App() {
  const hydrated = useApp((s) => s.hydrated);
  const themeHydrated = useThemePref((s) => s.hydrated);
  const phone = useApp((s) => s.phone);
  const name = useApp((s) => s.name);
  const address = useApp((s) => s.address);
  const location = useApp((s) => s.location);
  const customerId = useApp((s) => s.customerId);

  const [initialRoute, setInitialRoute] = useState<string>('Splash');

  // Register FCM token when customer is logged in
  useEffect(() => {
    if (!hydrated || !customerId) return;
    registerFcmToken(customerId).catch(() => {});

    // Listen for token refreshes
    const unsub = onTokenRefresh(async (newToken) => {
      try {
        await api.sendFcmToken(customerId, newToken);
      } catch {}
    });

    // Listen for foreground messages
    const unsubMsg = onForegroundMessage((msg) => {
      console.log('[FCM] Foreground message:', msg);
      const data = msg?.data;
      if (data?.type === 'WORKER_FOUND') {
        // Notification already handled by navigation
      }
    });

    return () => { unsub(); unsubMsg(); };
  }, [hydrated, customerId]);

  useEffect(() => {
    if (!hydrated || !themeHydrated) return;
    if (!phone || !customerId || !name || !address || !location) {
      setInitialRoute('Phone');
      return;
    }
    setInitialRoute('Home');
  }, [hydrated, themeHydrated, phone, customerId, name, address, location]);

  const isLoading = !hydrated || !themeHydrated || initialRoute === 'Splash';

  if (isLoading) {
    return (
      <ThemeProvider>
        <View style={styles.splash}>
          <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
          <Image source={require('./images/main.png')} style={styles.splashLogo} resizeMode="contain" />
          <ActivityIndicator size="large" color="#311090" style={styles.loader} />
        </View>
      </ThemeProvider>
    );
  }

  const showAuth = !phone || !customerId || !name || !address || !location;
  const startRoute: keyof RootStackParamList = showAuth ? 'Phone' : 'Home';

  return (
    <SafeAreaProvider>
    <ThemeProvider>
      <NavigationContainer>
        <RootStack.Navigator initialRouteName={startRoute} screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Phone" component={PhoneScreenComponent} />
          <RootStack.Screen name="Otp" component={OtpScreenComponent} />
          <RootStack.Screen name="Profile" component={ProfileScreenComponent} />
          <RootStack.Screen name="Welcome" component={WelcomeScreenComponent} />
          <RootStack.Screen name="Home" component={HomeScreenComponent} />
          <RootStack.Screen name="Problems" component={ProblemsScreenComponent} />
          <RootStack.Screen name="Searching" component={SearchingScreenComponent} />
          <RootStack.Screen name="Matched" component={MatchedScreenComponent} />
          <RootStack.Screen name="Arrived" component={ArrivedScreenComponent} />
          <RootStack.Screen name="Completed" component={CompletedScreenComponent} />
          <RootStack.Screen name="Rating" component={RatingScreenComponent} />
          <RootStack.Screen name="AI" component={AIScreenComponent} />
          <RootStack.Screen name="MyProfile" component={MyProfileScreenComponent} />
          <RootStack.Screen name="Address" component={AddressScreenComponent} />
        </RootStack.Navigator>
      </NavigationContainer>
      <CustomAlert />
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: '#F4F0FF',
    alignItems: 'center', justifyContent: 'center',
  },
  splashLogo: { width: 200, height: 70 },
  loader: { marginTop: 32 },
});

// ── Screen components ──────────────────────────────────────────────────────

function PhoneScreenComponent({ navigation }: any) {
  return <PhoneScreen onSent={(ph: string, devOtp?: string) => (navigation as any).navigate('Otp', { phone: ph, devOtp })} />;
}

function OtpScreenComponent({ navigation, route }: any) {
  const params = route?.params as { phone: string; devOtp?: string } | undefined;
  const name = useApp((s) => s.name);
  const storedAddress = useApp((s) => s.address);
  const location = useApp((s) => s.location);

  return (
    <OtpScreen
      phone={params?.phone || ''}
      devOtp={params?.devOtp}
      onVerified={() => {
        if (!name || !storedAddress) {
          (navigation as any).navigate('Profile');
        } else if (!location) {
          (navigation as any).navigate('Welcome');
        } else {
          (navigation as any).reset({ index: 0, routes: [{ name: 'Home' }] });
        }
      }}
      onBack={() => (navigation as any).goBack()}
    />
  );
}

function ProfileScreenComponent({ navigation }: any) {
  const location = useApp((s) => s.location);
  return <ProfileSetupScreen onDone={() => (navigation as any).navigate(location ? 'Home' : 'Welcome')} />;
}

function WelcomeScreenComponent({ navigation }: any) {
  return <WelcomeScreen onContinue={() => (navigation as any).navigate('Home')} />;
}

function HomeScreenComponent({ navigation }: any) {
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [confirmSub, setConfirmSub] = useState<SubProblem | null>(null);
  const activeJobId = useApp((s) => s.activeJobId);
  const customerId = useApp((s) => s.customerId);

  useEffect(() => {
    api.getCatalog().then(c => { setSkills(c.skills); setAddOns(c.addOns); }).catch(() => { });
  }, []);

  useEffect(() => {
    if (activeJobId) {
      (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Searching', params: { jobId: activeJobId } }] }));
    }
  }, [activeJobId, navigation]);

  useEffect(() => {
    if (customerId && !activeJobId) {
      api.getUnratedJob(customerId).then(res => {
        if (res.job) {
          (navigation as any).navigate('Rating', { 
            jobId: res.job.id, 
            finalPrice: res.job.finalPrice || res.job.basePrice, 
            workerName: res.job.worker?.name 
          });
        }
      }).catch(() => {});
    }
  }, [customerId, activeJobId]);

  return (
    <View style={{ flex: 1 }}>
      <HomeScreen
        onCategory={p => (navigation as any).navigate('Problems', { problem: p })}
        onAI={() => (navigation as any).navigate('AI')}
        onProfile={() => (navigation as any).navigate('MyProfile')}
        onAddress={() => (navigation as any).navigate('Address')}
      />
      <ConfirmSheet
        visible={!!confirmSub}
        subProblem={confirmSub}
        skill={confirmSub ? skills[confirmSub.skillKey] || null : null}
        addOns={addOns}
        onClose={() => setConfirmSub(null)}
        onBooked={() => setConfirmSub(null)}
      />
    </View>
  );
}

function ProblemsScreenComponent({ navigation, route }: any) {
  const problem = (route?.params as { problem: Problem })?.problem;
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [confirmSub, setConfirmSub] = useState<SubProblem | null>(null);

  useEffect(() => {
    api.getCatalog().then(c => { setSkills(c.skills); setAddOns(c.addOns); }).catch(() => { });
  }, []);

  if (!problem) {
    (navigation as any).goBack();
    return <View />;
  }

  return (
    <View style={{ flex: 1 }}>
      <ProblemListScreen problem={problem} skills={skills} onBack={() => (navigation as any).goBack()} onSelect={subId => setConfirmSub(problem.subProblems.find(s => s.id === subId) || null)} />
      <ConfirmSheet visible={!!confirmSub} subProblem={confirmSub} skill={confirmSub ? skills[confirmSub.skillKey] || null : null} addOns={addOns} onClose={() => setConfirmSub(null)} onBooked={() => setConfirmSub(null)} />
    </View>
  );
}

function SearchingScreenComponent({ navigation, route }: any) {
  const jobId = (route?.params as { jobId: string })?.jobId;

  useEffect(() => {
    const unsubscribe = BackHandler.addEventListener('hardwareBackPress', () => {
      showAlert('Booking in Progress', "Cannot go back while we're searching for a worker.");
      return true;
    });
    return () => unsubscribe.remove();
  }, []);

  if (!jobId) return <Loading />;

  const handleTerminal = () => {
    useApp.getState().setActiveJob(null);
    disconnectCustomerSocket();
    (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  };

  return (
    <SearchingScreen jobId={jobId} onAccepted={() => (navigation as any).replace('Matched', { jobId })} onTerminal={handleTerminal} />
  );
}

function MatchedScreenComponent({ navigation, route }: any) {
  const jobId = (route?.params as { jobId: string })?.jobId;
  if (!jobId) return <Loading />;
  const goHome = () => {
    useApp.getState().setActiveJob(null);
    disconnectCustomerSocket();
    (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  };
  return <MatchedScreen jobId={jobId} onArrived={() => (navigation as any).replace('Arrived', { jobId })} onTerminal={goHome} />;
}

function ArrivedScreenComponent({ navigation, route }: any) {
  const jobId = (route?.params as { jobId: string })?.jobId;
  if (!jobId) return <Loading />;
  const goHome = () => {
    useApp.getState().setActiveJob(null);
    disconnectCustomerSocket();
    (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  };
  return <ArrivedScreen jobId={jobId} onPaid={() => { (navigation as any).replace('Completed', { jobId, finalPrice: 0 }); }} onTerminal={goHome} />;
}

function CompletedScreenComponent({ navigation, route }: any) {
  const params = route?.params as { jobId: string; finalPrice: number };
  const [finalPrice, setFinalPrice] = useState(params?.finalPrice || 0);
  const [workerName, setWorkerName] = useState<string | undefined>();

  useEffect(() => {
    if (params?.jobId) {
      api.getJob(params.jobId).then(j => {
        setFinalPrice(j.finalPrice || 0);
        setWorkerName(j.worker?.name || undefined);
      }).catch(() => { });
    }
  }, [params?.jobId]);

  function goHome() {
    useApp.getState().setActiveJob(null);
    disconnectCustomerSocket();
    (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  }

  return (
    <CompletedScreen
      finalPrice={finalPrice}
      onDone={() => {
        // Navigate to rating screen instead of going straight home
        (navigation as any).replace('Rating', {
          jobId: params?.jobId,
          finalPrice,
          workerName,
        });
      }}
    />
  );
}

function RatingScreenComponent({ navigation, route }: any) {
  const params = route?.params as { jobId: string; finalPrice: number; workerName?: string };

  function goHome() {
    useApp.getState().setActiveJob(null);
    disconnectCustomerSocket();
    (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
  }

  return (
    <RatingScreen
      jobId={params?.jobId || ''}
      finalPrice={params?.finalPrice || 0}
      workerName={params?.workerName}
      onDone={goHome}
    />
  );
}

function AIScreenComponent({ navigation }: any) {
  return <AIScreen
    onClose={() => (navigation as any).goBack()}
    onBook={(jobId) => (navigation as any).replace('Searching', { jobId })}
  />;
}

function MyProfileScreenComponent({ navigation }: any) {
  return (
    <MyProfileScreen
      onClose={() => (navigation as any).goBack()}
      onLogout={() => {
        (navigation as any).dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Phone' }],
          })
        );
      }}
      onRebook={async (job) => {
        try {
          const loc = useApp.getState().location;
          if (!loc) {
            showAlert('Location required', 'Please set your location before rebooking.');
            return;
          }
          const res = await api.createJob({
            skillKey: job.skillKey,
            customerLocation: loc,
            customerId: useApp.getState().customerId,
            address: useApp.getState().address,
            customerName: useApp.getState().name,
            customerPhone: useApp.getState().phone || undefined,
            notes: job.notes || undefined,
            addOns: job.addOns || [],
          });
          useApp.getState().setActiveJob(res.jobId);
          (navigation as any).replace('Searching', { jobId: res.jobId });
        } catch (e: any) {
          showAlert('Rebook failed', e?.message || 'Could not create job. Please try again.');
        }
      }}
    />
  );
}

function AddressScreenComponent({ navigation }: any) {
  return <AddressScreen onClose={() => (navigation as any).goBack()} />;
}

function Loading() {
  return (
    <View style={[styles.splash, { backgroundColor: '#F4F0FF' }]}>
      <ActivityIndicator size="large" color="#311090" />
    </View>
  );
}