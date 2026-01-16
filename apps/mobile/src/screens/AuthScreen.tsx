import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabaseClient';
import { colors, glass, typography } from '../theme';

export default function AuthScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const signInWithEmail = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        setLoading(false);

        if (error) Alert.alert('Sign In Error', error.message);
    };

    const signUpWithEmail = async () => {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });
        setLoading(false);

        if (error) {
            Alert.alert('Sign Up Error', error.message);
        } else {
            Alert.alert('Success', 'Check your inbox for email verification!');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>AI Scheduler</Text>

            <View style={styles.form}>
                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    keyboardAppearance="dark"
                />
                <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    keyboardAppearance="dark"
                />

                {loading ? (
                    <ActivityIndicator size="large" color={colors.textPrimary} style={{ marginTop: 20 }} />
                ) : (
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.button} onPress={signInWithEmail}>
                            <Text style={styles.buttonText}>Sign In</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.button, styles.outlineButton]} onPress={signUpWithEmail}>
                            <Text style={[styles.buttonText, styles.outlineButtonText]}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: colors.obsidian,
    },
    title: {
        ...typography.headline,
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 40,
        color: colors.textPrimary,
    },
    form: {
        width: '100%',
    },
    input: {
        ...glass.card, // Use glass input style
        color: colors.textPrimary,
        padding: 15,
        borderRadius: 8,
        marginBottom: 15,
        fontSize: 16,
    },
    buttonContainer: {
        marginTop: 10,
        gap: 15,
    },
    button: {
        ...glass.interactive,
        backgroundColor: colors.glass, // stronger bg for primary?
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.borderGlass,
    },
    outlineButtonText: {
        color: colors.textPrimary,
    },
});
