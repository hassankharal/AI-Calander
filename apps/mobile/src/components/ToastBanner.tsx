import React, { useState, createContext, useContext, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme';

interface ToastContextType {
    showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [message, setMessage] = useState<string | null>(null);
    const [fadeAnim] = useState(() => new Animated.Value(0));

    const showToast = (msg: string) => {
        setMessage(msg);

        // Reset if already showing
        fadeAnim.setValue(0);

        Animated.sequence([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => setMessage(null));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {message && (
                <View style={styles.toastContainer} pointerEvents="none">
                    <Animated.View style={[styles.toast, { opacity: fadeAnim }]}>
                        <Text style={styles.toastText}>{message}</Text>
                    </Animated.View>
                </View>
            )}
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        bottom: 100, // Above tabs
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    toast: {
        backgroundColor: colors.obsidian,
        borderColor: colors.borderGlass,
        borderWidth: 1,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 24,
        marginHorizontal: 20,
    },
    toastText: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
});
