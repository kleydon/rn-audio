import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import React, {Component} from 'react';

const styles:any = StyleSheet.create({
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
  isLoading?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  style?: any;
  disabledStyle?: any;
  txtStyle?: any;
  imgLeftSrc?: any;
  imgLeftStyle?: any;
  indicatorColor?: string;
  activeOpacity?: number;
}

class Button extends Component<ItemProps, any> {

  private static defaultProps: Partial<ItemProps> = {
    isLoading: false,
    isDisabled: false,
    style: styles.btn,
    txtStyle: styles.txt,
    imgLeftStyle: styles.imgLeft,
    indicatorColor: 'white',
    activeOpacity: 0.5,
  }

  constructor(props: ItemProps) {
    super(props)
    this.state = {}
  }

  public render() {

    const style = {
      ...Button.defaultProps.style,
      ...(this.props.isDisabled ? Button.defaultProps.disabledStyle : {}),
      ...(this.props.isDisabled ? this.props.disabledStyle : {}),
      ...this.props.style,
    }
    const txtStyle = {
      ...Button.defaultProps.txtStyle,
      ...(this.props.isDisabled ? this.props.txtStyle : {}),
      ...this.props.txtStyle,
    }
    const imgLeftStyle = {
      ...Button.defaultProps.imgLeftStyle,
      ...this.props.imgLeftStyle,
    }

    if (this.props.isDisabled) {

      return (
        <View style={style}>
          <Text style={txtStyle}>{this.props.children}</Text>
        </View>
      );
    }
    if (this.props.isLoading) {
      return (
        <View style={style}>
          <ActivityIndicator size="small" color={this.props.indicatorColor} />
        </View>
      );
    }
    return (
      <TouchableOpacity
        activeOpacity={this.props.activeOpacity}
        onPress={this.props.onPress}
      >
        <View style={style}>
          {this.props.imgLeftSrc ? (
            <Image
              style={imgLeftStyle}
              source={this.props.imgLeftSrc}
            />
          ) : null}
          <Text style={txtStyle}>
            {this.props.children}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
}

export default Button;
