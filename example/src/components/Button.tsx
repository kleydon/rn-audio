import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, { ReactNode } from 'react';

const ss:any = StyleSheet.create({
  btn: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { //Overlaid on top of btn, above
    backgroundColor: 'rgb(243,243,243)',
    borderColor: '#333',
  },
  txt: {
    fontSize: 14,
    color: 'white',
  },
  imgLeft: {
    width: 24,
    height: 24,
    position: 'absolute',
    left: 16,
  },
});

interface ItemProps {
  isLoading?: boolean,
  isDisabled?: boolean,
  onPress?: () => void,
  style?: any,
  disabledStyle?: any,
  txtStyle?: any,
  imgLeftSrc?: any,
  imgLeftStyle?: any,
  indicatorColor?: string,
  activeOpacity?: number,
  children: ReactNode
}

export function Button(props: ItemProps) {

  const defaultProps: Partial<ItemProps> = {
    isLoading: false,
    isDisabled: false,
    style: ss.btn,
    txtStyle: ss.txt,
    imgLeftStyle: ss.imgLeft,
    indicatorColor: 'white',
    activeOpacity: 0.5,
  }
  const style = {
    ...defaultProps.style,
    ...(props.isDisabled ? defaultProps.disabledStyle : {}),
    ...(props.isDisabled ? props.disabledStyle : {}),
    ...props.style,
  }
  const txtStyle = {
    ...defaultProps.txtStyle,
    ...(props.isDisabled ? props.txtStyle : {}),
    ...props.txtStyle,
  }
  const imgLeftStyle = {
    ...defaultProps.imgLeftStyle,
    ...props.imgLeftStyle,
  }

  if (props.isDisabled) {
    return (
      <View style={style}>
        <Text style={txtStyle}>{props.children}</Text>
      </View>
    )
  }
  if (props.isLoading) {
    return (
      <View style={style}>
        <ActivityIndicator size="small" color={props.indicatorColor} />
      </View>
    )
  }
  return (
    <TouchableOpacity
      activeOpacity={props.activeOpacity}
      onPress={props.onPress}
    >
      <View style={style}>
        {props.imgLeftSrc ? (
          <Image
            style={imgLeftStyle}
            source={props.imgLeftSrc}
          />
        ) : null}
        <Text style={txtStyle}>
          {props.children}
        </Text>
      </View>
    </TouchableOpacity>
  )
}
