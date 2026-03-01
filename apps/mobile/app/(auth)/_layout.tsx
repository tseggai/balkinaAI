import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen
        name="phone-login"
        options={{ headerShown: true, title: 'Phone Login', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="verify-otp"
        options={{ headerShown: true, title: 'Verify Code', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="email-login"
        options={{ headerShown: true, title: 'Email Login', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="profile-setup"
        options={{ headerShown: true, title: 'Profile Setup' }}
      />
    </Stack>
  );
}
