import React, { useEffect } from 'react';
import { Animated, ViewStyle, StyleSheet, Easing } from 'react-native';
import { colors } from '../theme/tokens';

interface PulseGlowProps {
    active: boolean;
    color?: string;
    size?: number;
    style?: ViewStyle;
}

export function PulseGlow({ active, color = colors.cyan, size = 12, style }: PulseGlowProps) {
    const anim = React.useMemo(() => new Animated.Value(0), []);

    useEffect(() => {
        if (active) {
            const loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );
            loop.start();
            return () => loop.stop();
        } else {
            anim.setValue(0);
        }
    }, [active, anim]);

    const opacity = React.useMemo(() => anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0.9],
    }), [anim]);

    const scale = React.useMemo(() => anim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1.1],
    }), [anim]);

    if (!active) return null;

    return (
        <Animated.View
            style={[
                styles.dot,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    opacity,
                    transform: [{ scale }],
                },
                style,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    dot: {
        // base styles
    },
});
