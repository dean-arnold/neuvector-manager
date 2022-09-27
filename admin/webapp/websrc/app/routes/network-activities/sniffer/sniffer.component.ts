import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { GraphService } from '../graph.service';
import { SniffService } from './sniff.service';
import {
  ActivityState,
  PopupState,
} from '@common/types/network-activities/activityState';
import { AuthUtilsService } from '@common/utils/auth.utils';
import { TranslateService } from '@ngx-translate/core';
import { UtilsService } from '@common/utils/app.utils';
import { Options } from '@angular-slider/ngx-slider';

@Component({
  selector: 'app-sniffer',
  templateUrl: './sniffer.component.html',
  styleUrls: ['./sniffer.component.scss'],
})
export class SnifferComponent implements AfterViewInit, OnInit {
  isPacketCapAuthorized: boolean = false;
  sniffer: any;
  exportUrl: string = '';
  downloadId: any;
  exportFilename: string = '';
  onSnifferErr: boolean = false;
  snifferErrMsg: string = '';

  disabled: boolean = true;

  get entriesGridHeight(): number {
    return this._entriesGridHeight;
  }
  @ViewChild('sniffers', { static: false }) containerSniffView!: ElementRef;
  @ViewChild('entriesGridHeight', { static: false }) heightView!: ElementRef;

  private _sniffers;

  gridOptions;

  pcap;
  options: Options = {};

  private _entriesGridHeight: number = 0;

  _popupState: ActivityState;

  get popupState() {
    return this._popupState;
  }

  @Input() containerName;
  @Input() containerId;

  @Input()
  set popupState(value: ActivityState) {
    this._popupState = value;
  }

  @Output() onStopRefresh = new EventEmitter<boolean>();

  constructor(
    private translate: TranslateService,
    private authUtilsService: AuthUtilsService,
    private utils: UtilsService,
    public graphService: GraphService,
    public sniffService: SniffService
  ) {
    this._popupState = new ActivityState(PopupState.onInit);
  }

  ngAfterViewInit(): void {}

  get sniffers() {
    return this._sniffers;
  }

  @Input()
  set sniffers(value) {
    this._sniffers = value;
  }

  @Input()
  set entriesGridHeight(value) {
    this._entriesGridHeight = value;
  }

  ngOnInit() {
    this.isPacketCapAuthorized =
      this.authUtilsService.getDisplayFlag('write_network_rule');
    this.sniffService.prepareSnifferColumns();
    this.gridOptions = this.sniffService.snifferGridOptions;
    this.gridOptions.onSelectionChanged = () => {
      this.onSnifferChanged();
    };

    const MINUTES = this.translate.instant('setting.MINUTES');
    const SECONDS = this.translate.instant('setting.SECONDS');
    const convertMinutes = value => {
      if (!value) return '';
      let minutes = Math.floor(value / 60);
      let seconds = Math.round(value % 60);

      let sec = seconds === 0 ? '' : `${seconds}${SECONDS}`;
      if (seconds === 1) sec = sec.replace('s', '');
      let min = minutes === 0 ? '' : `${minutes}${MINUTES}`;
      if (minutes === 1) min = min.replace('s', '');
      if (!minutes) return `${sec}`;
      return seconds > 0 ? `${min}, ${sec}` : `${min}`;
    };

    this.options = {
      floor: 0,
      minRange: 5,
      ceil: 600,
      step: 5,
      tickStep: 30,
      showSelectionBar: true,
      disabled: true,
      showTicks: true,
      translate: convertMinutes,
    };

    this.pcap = {
      seconds: 0,
      minValue: 5,
      options: this.options,
    };
  }

  stopRefreshSniffer = () => {
    this.onStopRefresh.emit(true);
  };

  onSnifferChanged() {
    let selectedRows = this.gridOptions.api.getSelectedRows();
    this.sniffer = selectedRows[0];
    this.graphService.keepLive();
  }

  getSniffers = () =>
    this.sniffService.getSniffers(this.containerId).subscribe(response => {
      this.sniffers = response['sniffers'];
    });

  startSniff = containerId => {
    console.log(containerId);
    console.log(this.containerId);
    this.sniffService.startSniff(containerId).subscribe(
      response => this.getSniffers(),
      err => {
        this.onSnifferErr = true;
        this.snifferErrMsg = this.utils.getErrorMessage(err);
      }
    );
  };

  toggleSchedule = () => {
    this.disabled = !this.disabled;
    if (this.disabled) this.pcap.seconds = 0;
    this.pcap.options = Object.assign({}, this.pcap.options, {
      disabled: this.disabled,
    });
    this.graphService.keepLive();
  };

  disableStart = () => {
    if (!this.sniffers) return false;
    let startedJob = this.sniffers.filter(v => v.status === 'running')[0];
    return !!startedJob;
  };

  stopSniff = jobId =>
    this.sniffService.stopSniff(jobId).subscribe(
      response => this.getSniffers(),
      err => {
        console.warn(err);
        this.onSnifferErr = true;
        this.snifferErrMsg = this.utils.getErrorMessage(err);
      }
    );

  deleteSniff = jobId =>
    this.sniffService.deleteSniff(jobId).subscribe(
      response => {
        this.getSniffers();
        this.sniffer = null;
      },
      err => {
        console.warn(err);
        this.onSnifferErr = true;
        this.snifferErrMsg = this.utils.getErrorMessage(err);
      }
    );

  downloadPacket = jobId => {
    this.sniffService.downloadPacket(jobId).subscribe(response => {
      let raw = response.headers.get('Content-Type');
      let nameAndParts = this.sniffService.multiPart_parse(response, raw);
      this.exportFilename = nameAndParts.filename;
      this.exportUrl = URL.createObjectURL(
        new Blob([nameAndParts.parts[nameAndParts.filename]])
      );
      this.downloadId = jobId;
    });
  };
}