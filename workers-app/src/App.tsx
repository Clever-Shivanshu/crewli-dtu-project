import { CustomAlert } from "./components/CustomAlert";
import { showAlert } from "./store/alert";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  BackHandler,
  Alert,
  Image,
} from 'react-native';
import { NavigationContainer, useNavigation, CommonActions, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  api,
  ApiError,
  cacheWorker,
  CachedWorker,
  clearToken,
  Profession,
  refreshIfStale,
  Job,
} from './services/api';
import { useAuth } from './store/auth';
import { fbGetToken, fbRequestPermission } from './services/firebase';
import { requestLocationPermission } from './services/location';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { NameScreen } from './screens/NameScreen';
import { PhoneOtpScreen } from './screens/PhoneOtpScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { ProfessionScreen } from './screens/ProfessionScreen';
import { SkillsScreen } from './screens/SkillsScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { JobActiveScreen } from './screens/JobActiveScreen';
import { CompletedCongratsScreen } from './screens/CompletedCongratsScreen';
import { AllJobsScreen } from './screens/AllJobsScreen';
import { ThemeProvider, useThemePref } from './theme/ThemeContext';
import { useActiveJob, isActive } from './store/activeJob';
import { theme } from './theme';
import { CommissionScreen } from './screens/CommissionScreen';
import { CommissionPaymentScreen } from './screens/CommissionPaymentScreen';
import { WorkerOtpScreen } from './screens/WorkerOtpScreen';

export type RootStackParamList = {
  Welcome: { phone?: string; exists?: boolean; onboarded?: boolean };
  Name: { phone: string };
  Phone: { name: string; initialPhone?: string };
  Language: { name: string };
  Profession: { name: string; language: string };
  ProfessionFromServer: undefined;
  Skills: { name: string; language: string; profession: Profession };
  Dashboard: undefined;
  Profile: { worker: CachedWorker };
  JobActive: { jobId: string };
  CompletedCongrats: { finalPrice: number; workerName?: string };
  AllJobs: undefined;
  Commission: undefined;
  CommissionPayment: { amount: number; isPremium: boolean };
  WorkerOtp: { jobId: string; customerName?: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const hydrated = useAuth((s) => s.hydrated);
  const themeHydrated = useThemePref((s) => s.hydrated);
  const accessToken = useAuth((s) => s.accessToken);

  const [initialRoute, setInitialRoute] = useState<string>('Splash');

  useEffect(() => {
    if (!hydrated || !themeHydrated) return;

    if (!accessToken) {
      setInitialRoute('Welcome');
      return;
    }

    setInitialRoute('Dashboard');
  }, [hydrated, themeHydrated, accessToken]);

  const isLoading = !hydrated || !themeHydrated || initialRoute === 'Splash';

  if (isLoading) {
    return (
      <ThemeProvider>
        <View style={styles.splash}>
          <StatusBar barStyle="light-content" />
          <View style={styles.logoContainer}>
            <Image source={require('./images/main.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <ActivityIndicator size="large" color="#fff" style={styles.loader} />
        </View>
      </ThemeProvider>
    );
  }

  const showOnboarding = !accessToken;

  return (
    <SafeAreaProvider>
    <ThemeProvider>
      <NavigationContainer>
        <RootStack.Navigator
          initialRouteName={showOnboarding ? 'Welcome' : 'Dashboard'}
          screenOptions={{ headerShown: false }}
        >
          <RootStack.Screen name="Welcome" component={WelcomeScreenComponent} />
          <RootStack.Screen name="Name" component={NameScreenComponent} />
          <RootStack.Screen name="Phone" component={PhoneOtpScreenComponent} />
          <RootStack.Screen name="Language" component={LanguageScreenComponent} />
          <RootStack.Screen name="Profession" component={ProfessionScreenComponent} />
          <RootStack.Screen name="ProfessionFromServer" component={ProfessionFromServerComponent} />
          <RootStack.Screen name="Skills" component={SkillsScreenComponent} />
          <RootStack.Screen name="Dashboard" component={DashboardScreenComponent} />
          <RootStack.Screen name="Profile" component={ProfileScreenComponent} />
          <RootStack.Screen name="JobActive" component={JobActiveScreenComponent} />
          <RootStack.Screen name="WorkerOtp" component={WorkerOtpScreenComponent} />
          <RootStack.Screen name="CompletedCongrats" component={CompletedCongratsComponent} />
          <RootStack.Screen name="AllJobs" component={AllJobsScreenComponent} />
          <RootStack.Screen name="Commission" component={CommissionScreenComponent} />
          <RootStack.Screen name="CommissionPayment" component={CommissionPaymentScreenComponent} />
        </RootStack.Navigator>
      </NavigationContainer>
      <CustomAlert />
    </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#ffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 240,
    height: 240,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 100,
    height: 100,
  },
  loader: {
    marginTop: 24,
  },
});

function WelcomeScreenComponent({ navigation }: any) {
  return (
    <WelcomeScreen
      onContinue={({ phone, exists, onboarded }) => {
        if (exists && onboarded) {
          (navigation as any).navigate('Phone', { name: '', initialPhone: phone });
        } else {
          (navigation as any).navigate('Name', { phone });
        }
      }}
    />
  );
}

function NameScreenComponent({ navigation, route }: any) {
  const phone = (route?.params as { phone: string })?.phone || '';
  return <NameScreen onNext={(name) => (navigation as any).navigate('Phone', { name, initialPhone: phone })} />;
}

function PhoneOtpScreenComponent({ navigation, route }: any) {
  const params = route?.params as { name: string; initialPhone?: string } | undefined;
  const name = params?.name || '';
  const initialPhone = params?.initialPhone;
  const setWorkerStore = useAuth((s) => s.setWorker);

  return (
    <PhoneOtpScreen
      name={name}
      initialPhone={initialPhone}
      onVerified={(w) => {
        setWorkerStore(w);
        if (!w.name) {
          (navigation as any).navigate('Name', { phone: w.phone });
        } else if (!w.language) {
          (navigation as any).navigate('Language', { name: w.name });
        } else if (!w.profession || w.skills.length === 0) {
          (navigation as any).navigate('ProfessionFromServer');
        } else {
          (navigation as any).reset({ index: 0, routes: [{ name: 'Dashboard' }] });
        }
      }}
    />
  );
}

function LanguageScreenComponent({ navigation, route }: any) {
  const name = (route?.params as { name: string })?.name || '';
  return <LanguageScreen onPicked={(lang) => (navigation as any).navigate('Profession', { name, language: lang })} />;
}

function ProfessionScreenComponent({ navigation, route }: any) {
  const params = route?.params as { name: string; language: string } | undefined;
  const name = params?.name || '';
  const language = params?.language || 'en';

  return (
    <ProfessionScreen
      onPicked={(prof) => (navigation as any).navigate('Skills', { name, language, profession: prof })}
    />
  );
}

function ProfessionFromServerComponent({ navigation }: any) {
  const worker = useAuth((s) => s.worker);

  return (
    <ProfessionScreen
      onPicked={(prof) =>
        (navigation as any).navigate('Skills', {
          name: worker?.name || '',
          language: worker?.language || 'en',
          profession: prof
        })
      }
    />
  );
}

function SkillsScreenComponent({ navigation, route }: any) {
  const params = route?.params as { name: string; language: string; profession: Profession } | undefined;
  const name = params?.name || '';
  const language = params?.language || 'en';
  const profession = params?.profession;
  const setWorkerStore = useAuth((s) => s.setWorker);

  if (!profession) {
    (navigation as any).goBack();
    return <View />;
  }

  return (
    <SkillsScreen
      name={name}
      language={language}
      profession={profession}
      onDone={(w) => {
        setWorkerStore(w);
        (navigation as any).reset({ index: 0, routes: [{ name: 'Dashboard' }] });
      }}
    />
  );
}

function DashboardScreenComponent({ navigation }: any) {
  const worker = useAuth((s) => s.worker);
  const setWorkerStore = useAuth((s) => s.setWorker);
  const activeJob = useActiveJob((s) => s.job);
  const setActiveJob = useActiveJob((s) => s.setJob);

  useEffect(() => {
    if (activeJob && isActive(activeJob)) {
      (navigation as any).dispatch(CommonActions.reset({
        index: 0,
        routes: [{ name: 'JobActive', params: { jobId: activeJob.id } }]
      }));
    }
  }, [activeJob, navigation]);

  useEffect(() => {
    api.myJobs().then(res => {
      const active = res.jobs.find(j => isActive(j));
      if (active) setActiveJob(active);
    }).catch(() => {});
  }, []);

  return (
    <DashboardScreen
      worker={worker!}
      setWorker={(w) => {
        if (w) setWorkerStore(w);
        else (navigation as any).reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }}
      onOpenProfile={() => (navigation as any).navigate('Profile', { worker: worker! })}
      onViewAllJobs={() => (navigation as any).navigate('AllJobs')}
      onOpenCommission={() => (navigation as any).navigate('Commission')}
    />
  );
}

function ProfileScreenComponent({ navigation, route }: any) {
  const worker = (route?.params as { worker: CachedWorker })?.worker;
  const setWorkerStore = useAuth((s) => s.setWorker);

  return (
    <ProfileScreen
      worker={worker!}
      onClose={() => (navigation as any).goBack()}
      onUpdated={(w) => {
        setWorkerStore(w);
        cacheWorker(w);
      }}
    />
  );
}

function JobActiveScreenComponent({ navigation, route }: any) {
  const jobId = (route?.params as { jobId: string })?.jobId;
  const [job, setJob] = useState<Job | null>(null);
  const setActiveJob = useActiveJob((s) => s.setJob);

  useEffect(() => {
    if (jobId) {
      api.getJob(jobId).then(setJob).catch(() => { });

      const interval = setInterval(() => {
        api.getJob(jobId)
          .then(setJob)
          .catch(() => { });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [jobId]);

  useEffect(() => {
    const unsubscribe = BackHandler.addEventListener('hardwareBackPress', () => {
      if (job && isActive(job)) {
        showAlert('Job in Progress', 'Cannot go back while job is active.', [{ text: 'OK' }]);
        return true;
      }
      return false;
    });
    return () => unsubscribe.remove();
  }, [job]);

  if (!job || !jobId) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const handleComplete = (finalPrice: number, workerName?: string) => {
    (navigation as any).dispatch(CommonActions.reset({
      index: 0,
      routes: [{ name: 'CompletedCongrats', params: { finalPrice, workerName } }],
    }));
  };

  const handleCancel = () => {
    (navigation as any).dispatch(CommonActions.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    }));
  };

  return <JobActiveScreen job={job} onComplete={handleComplete} onCancel={handleCancel} />;
}

function CompletedCongratsComponent({ navigation, route }: any) {
  const params = route?.params as { finalPrice: number; workerName?: string };
  return (
    <CompletedCongratsScreen
      finalPrice={params?.finalPrice || 0}
      workerName={params?.workerName}
      onGoHome={() => {
        (navigation as any).dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Dashboard' }] }));
      }}
    />
  );
}

function AllJobsScreenComponent({ navigation }: any) {
  return (
    <AllJobsScreen
      onBack={() => (navigation as any).goBack()}
      onViewJob={(jobId: string) => {
        (navigation as any).navigate('JobActive', { jobId });
      }}
    />
  );
}

function CommissionScreenComponent({ navigation }: any) {
  return (
    <CommissionScreen
      onBack={() => (navigation as any).goBack()}
      onPayNow={(amount, isPremium) =>
        (navigation as any).navigate('CommissionPayment', { amount, isPremium })
      }
    />
  );
}

function WorkerOtpScreenComponent({ navigation, route }: any) {
  const { jobId, customerName } = route.params as { jobId: string; customerName?: string };
  return (
    <WorkerOtpScreen
      jobId={jobId}
      customerName={customerName}
      onBack={() => (navigation as any).goBack()}
      onVerified={() => {
        (navigation as any).goBack();
      }}
    />
  );
}

function CommissionPaymentScreenComponent({ navigation, route }: any) {
  const { amount, isPremium } = route.params as { amount: number; isPremium: boolean };
  return (
    <CommissionPaymentScreen
      amount={amount}
      isPremium={isPremium}
      onBack={() => (navigation as any).goBack()}
      onSuccess={() => {
        // Pop back to Commission screen so balance refreshes on mount.
        (navigation as any).dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: 'Dashboard' },
              { name: 'Commission' },
            ],
          })
        );
      }}
    />
  );
}